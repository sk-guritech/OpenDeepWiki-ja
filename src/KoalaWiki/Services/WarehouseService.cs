using FastService;
using KoalaWiki.Core.DataAccess;
using KoalaWiki.Dto;
using KoalaWiki.Entities;
using KoalaWiki.Functions;
using KoalaWiki.KoalaWarehouse;
using LibGit2Sharp;
using MapsterMapper;
using Microsoft.EntityFrameworkCore;

namespace KoalaWiki.Services;

public class WarehouseService(IKoalaWikiContext access, IMapper mapper, WarehouseStore warehouseStore) : FastApi
{
    /// <summary>
    /// 最後にコミットされたリポジトリを取得する
    /// </summary>
    /// <returns></returns>
    public async Task<object> GetLastWarehouseAsync(string address)
    {
        // .git で終わっていない場合は追加
        if (!address.EndsWith(".git"))
        {
            address += ".git";
        }

        var query = await access.Warehouses
            .AsNoTracking()
            .Where(x => x.Address == address)
            .FirstOrDefaultAsync();

        // リポジトリが見つからない場合は例外
        if (query == null)
        {
            throw new NotFoundException("リポジトリが存在しません");
        }

        return new
        {
            query.Name,
            query.Address,
            query.Description,
            query.Version,
            query.Status,
            query.Error
        };
    }

    public async Task<DocumentCommitRecord?> GetChangeLogAsync(string owner, string name)
    {
        var warehouse = await access.Warehouses
            .AsNoTracking()
            .Where(x => x.Name == name && x.OrganizationName == owner)
            .FirstOrDefaultAsync();

        // リポジトリが見つからない場合は例外
        if (warehouse == null)
        {
            throw new NotFoundException("リポジトリが存在しません");
        }

        var commit = await access.DocumentCommitRecords.FirstOrDefaultAsync(x => x.WarehouseId == warehouse.Id);

        return commit;
    }

    /// <summary>
    /// リポジトリを登録する
    /// </summary>
    public async Task SubmitWarehouseAsync(WarehouseInput input, HttpContext context)
    {
        try
        {
            if (!input.Address.EndsWith(".git"))
            {
                input.Address += ".git";
            }

            var value = await access.Warehouses.FirstOrDefaultAsync(x => x.Address == input.Address);
            // 同じアドレスのリポジトリが既に存在するかチェック
            if (value?.Status is WarehouseStatus.Completed or WarehouseStatus.Pending or WarehouseStatus.Processing)
            {
                throw new Exception("同じリポジトリが既に存在します");
            }

            // 古いリポジトリ情報を削除
            await access.Warehouses
                .Where(x => x.Address == input.Address)
                .ExecuteDeleteAsync();

            var entity = mapper.Map<Warehouse>(input);
            entity.Name = string.Empty;
            entity.Description = string.Empty;
            entity.Version = string.Empty;
            entity.Error = string.Empty;
            entity.Prompt = string.Empty;
            entity.Branch = string.Empty;
            entity.Type = "git";
            entity.CreatedAt = DateTime.UtcNow;
            entity.OptimizedDirectoryStructure = string.Empty;
            entity.Id = Guid.NewGuid().ToString();
            await access.Warehouses.AddAsync(entity);

            await access.SaveChangesAsync();

            await warehouseStore.WriteAsync(entity);

            await context.Response.WriteAsJsonAsync(new
            {
                code = 200,
                message = "登録に成功しました"
            });
        }
        catch (Exception e)
        {
            await context.Response.WriteAsJsonAsync(new
            {
                code = 500,
                message = e.Message
            });
        }
    }

    /// <summary>
    /// リポジトリの概要を取得する
    /// </summary>
    public async Task GetWarehouseOverviewAsync(string owner, string name, HttpContext context)
    {
        var query = await access.Warehouses
            .AsNoTracking()
            .Where(x => x.Name == name && x.OrganizationName == owner)
            .FirstOrDefaultAsync();

        // リポジトリが見つからない場合は例外
        if (query == null)
        {
            throw new NotFoundException("リポジトリが存在しません");
        }

        var document = await access.Documents
            .AsNoTracking()
            .Where(x => x.WarehouseId == query.Id)
            .FirstOrDefaultAsync();

        var overview = await access.DocumentOverviews.FirstOrDefaultAsync(x => x.DocumentId == document.Id);

        if (overview == null)
        {
            throw new NotFoundException("概要が見つかりません");
        }

        await context.Response.WriteAsJsonAsync(new
        {
            content = overview.Content,
            title = overview.Title
        });
    }

    /// <summary>
    /// リポジトリ一覧を取得する（ページングおよびキーワード検索対応）
    /// </summary>
    /// <param name="page">現在のページ（1始まり）</param>
    /// <param name="pageSize">1ページあたりの件数</param>
    /// <param name="keyword">検索キーワード（リポジトリ名またはアドレスにマッチ）</param>
    /// <returns>総件数とリポジトリリストを含むページDTO</returns>
    public async Task<PageDto<Warehouse>> GetWarehouseListAsync(int page, int pageSize, string keyword)
    {
        var query = access.Warehouses
            .AsNoTracking()
            .Where(x => x.Status == WarehouseStatus.Completed || x.Status == WarehouseStatus.Processing);

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            query = query.Where(x => x.Name.Contains(keyword) || x.Address.Contains(keyword));
        }

        var total = await query.CountAsync();
        var list = await query
            .Select(x => new Warehouse()
            {
                Id = x.Id,
                Name = x.Name,
                Address = x.Address,
                Description = x.Description,
                Version = x.Version,
                Status = x.Status,
                Error = x.Error,
                CreatedAt = x.CreatedAt,
                IsRecommended = x.IsRecommended,
                OrganizationName = x.OrganizationName,
                Prompt = x.Prompt,
                Branch = x.Branch,
                Email = x.Email,
                Type = x.Type,
            })
            .OrderByDescending(x => x.IsRecommended)
            .ThenByDescending(x => x.Status == WarehouseStatus.Completed)
            .ThenByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PageDto<Warehouse>(total, list);
    }

    [EndpointSummary("指定したリポジトリ内のコードファイルを取得する")]
    public async Task<ResultDto<string>> GetFileContent(string warehouseId, string path)
    {
        var query = await access.Documents
            .AsNoTracking()
            .Where(x => x.WarehouseId == warehouseId)
            .FirstOrDefaultAsync();

        if (query == null)
        {
            throw new NotFoundException("ファイルが存在しません");
        }

        var fileFunction = new FileFunction(query.GitPath);

        var result = await fileFunction.ReadFileAsync(path);

        return ResultDto<string>.Success(result);
    }
}
