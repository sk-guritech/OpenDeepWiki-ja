using System.Collections.Concurrent;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.RegularExpressions;
using KoalaWiki.Core.DataAccess;
using KoalaWiki.Domains;
using KoalaWiki.Entities;
using KoalaWiki.Entities.DocumentFile;
using KoalaWiki.Extensions;
using KoalaWiki.Functions;
using KoalaWiki.Options;
using LibGit2Sharp;
using Microsoft.EntityFrameworkCore;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using Microsoft.SemanticKernel.Connectors.OpenAI;
using Newtonsoft.Json;
using Serilog;

namespace KoalaWiki.KoalaWarehouse;

public class DocumentsService
{
    private static readonly int TaskMaxSizePerUser = 5;

    /// <summary>
    /// 組み込みの拡張子なし除外ファイル
    /// </summary>
    private static readonly string[] BuiltInExcludedFiles =
    [
    ];

    static DocumentsService()
    {
        // 環境変数を読み取ります
        var maxSize = Environment.GetEnvironmentVariable("TASK_MAX_SIZE_PER_USER").GetTrimmedValueOrEmpty();
        if (!string.IsNullOrEmpty(maxSize) && int.TryParse(maxSize, out var maxSizeInt))
        {
            TaskMaxSizePerUser = maxSizeInt;
        }
    }

    /// <summary>
    /// 指定したディレクトリの .gitignore 設定で無視されるファイルを解析する
    /// </summary>
    private static string[] GetIgnoreFiles(string path)
    {
        var ignoreFilePath = Path.Combine(path, ".gitignore");
        if (File.Exists(ignoreFilePath))
        {
            // コメント行を除去
            var lines = File.ReadAllLines(ignoreFilePath);
            var ignoreFiles = lines.Where(x => !string.IsNullOrWhiteSpace(x) && !x.StartsWith("#"))
                .Select(x => x.Trim()).ToList();

            ignoreFiles.AddRange(DocumentOptions.ExcludedFiles);

            return ignoreFiles.ToArray();
        }

        return [];
    }

    public static string GetCatalogue(string path)
    {
        var ignoreFiles = GetIgnoreFiles(path);

        var pathInfos = new List<PathInfo>();
        // ディレクトリを再帰的に走査
        ScanDirectory(path, pathInfos, ignoreFiles);
        var catalogue = new StringBuilder();

        foreach (var info in pathInfos)
        {
            // Constant.GitPath のプレフィックスを削除
            var relativePath = info.Path.Replace(path, "").TrimStart('\\');

            // . で始まるファイルを除外
            if (relativePath.StartsWith("."))
                continue;

            catalogue.Append($"{relativePath}\n");
        }

        return catalogue.ToString();
    }

    public static async Task<string> GetCatalogueSmartFilterAsync(string path, string readme)
    {
        var ignoreFiles = GetIgnoreFiles(path);

        var pathInfos = new List<PathInfo>();
        // ディレクトリを再帰的に走査
        ScanDirectory(path, pathInfos, ignoreFiles);
        var catalogue = new StringBuilder();

        foreach (var info in pathInfos)
        {
            var relativePath = info.Path.Replace(path, "").TrimStart('\\');
            if (relativePath.StartsWith("."))
                continue;

            catalogue.Append($"{relativePath}\n");
        }

        // ファイル数が3000未満なら直接返却
        if (pathInfos.Count < 3000)
        {
            return catalogue.ToString();
        }

        // スマートフィルター無効なら直接返却
        if (DocumentOptions.EnableSmartFilter == false)
        {
            return catalogue.ToString();
        }

        Log.Logger.Information("ディレクトリ構造の最適化を開始");

        var analysisModel = KernelFactory.GetKernel(OpenAIOptions.Endpoint,
            OpenAIOptions.ChatApiKey, path, OpenAIOptions.AnalysisModel);

        var codeDirSimplifier = analysisModel.Plugins["CodeAnalysis"]["CodeDirSimplifier"];

        var sb = new StringBuilder();

        await foreach (var item in analysisModel.InvokeStreamingAsync(codeDirSimplifier, new KernelArguments(
                           new OpenAIPromptExecutionSettings()
                           {
                               MaxTokens = GetMaxTokens(OpenAIOptions.AnalysisModel)
                           })
        {
            ["code_files"] = catalogue.ToString(),
            ["readme"] = readme
        }))
        {
            sb.Append(item);
        }

        // <response_file> タグの内容を抽出
        var regex = new Regex("<response_file>(.*?)</response_file>", RegexOptions.Singleline);
        var match = regex.Match(sb.ToString());
        if (match.Success)
        {
            var extractedContent = match.Groups[1].Value;
            catalogue.Clear();
            catalogue.Append(extractedContent);
        }
        else
        {
            // ```json ブロックを抽出
            var jsonRegex = new Regex("```json(.*?)```", RegexOptions.Singleline);
            var jsonMatch = jsonRegex.Match(sb.ToString());
            if (jsonMatch.Success)
            {
                var extractedContent = jsonMatch.Groups[1].Value;
                catalogue.Clear();
                catalogue.Append(extractedContent);
            }
            else
            {
                catalogue.Clear();
                catalogue.Append(sb);
            }
        }

        return catalogue.ToString();
    }

    public static async Task<string> GenerateReadMe(Warehouse warehouse, string path,
        IKoalaWikiContext koalaWikiContext)
    {
        var readme = await ReadMeFile(path);
        var catalogue = GetCatalogue(path);

        if (string.IsNullOrEmpty(readme))
        {
            var kernel = KernelFactory.GetKernel(OpenAIOptions.Endpoint,
                OpenAIOptions.ChatApiKey,
                path, OpenAIOptions.ChatModel);

            var fileKernel = KernelFactory.GetKernel(OpenAIOptions.Endpoint,
                OpenAIOptions.ChatApiKey, path, OpenAIOptions.ChatModel, false);

            // README を生成
            var generateReadmePlugin = kernel.Plugins["CodeAnalysis"]["GenerateReadme"];
            var generateReadme = await fileKernel.InvokeAsync(generateReadmePlugin, new KernelArguments(
                new OpenAIPromptExecutionSettings()
                {
                    ToolCallBehavior = ToolCallBehavior.AutoInvokeKernelFunctions,
                    Temperature = 0.5,
                })
            {
                ["catalogue"] = catalogue,
                ["git_repository"] = warehouse.Address,
                ["branch"] = warehouse.Branch
            });

            readme = generateReadme.ToString();
            // <readme> タグの内容を抽出
            var readmeRegex = new Regex(@"<readme>(.*?)</readme>", RegexOptions.Singleline);
            var readmeMatch = readmeRegex.Match(readme);

            if (readmeMatch.Success)
            {
                readme = readmeMatch.Groups[1].Value;
            }

            await koalaWikiContext.Warehouses.Where(x => x.Id == warehouse.Id)
                .ExecuteUpdateAsync(x => x.SetProperty(y => y.Readme, readme));
        }

        return readme;
    }

    /// <summary>
    /// ドキュメントを非同期処理し、ディレクトリ解析、更新ログ生成、DB保存を行う
    /// </summary>
    public async Task HandleAsync(Document document, Warehouse warehouse, IKoalaWikiContext dbContext,
        string gitRepository)
    {
        // リポジトリのディレクトリ構造を解析します
        var path = document.GitPath;

        var kernel = KernelFactory.GetKernel(OpenAIOptions.Endpoint,
            OpenAIOptions.ChatApiKey,
            path, OpenAIOptions.ChatModel);

        var fileKernel = KernelFactory.GetKernel(OpenAIOptions.Endpoint,
            OpenAIOptions.ChatApiKey, path, OpenAIOptions.ChatModel, false);

        var readme = await GenerateReadMe(warehouse, path, dbContext);

        var catalogue = warehouse.OptimizedDirectoryStructure;
        if (string.IsNullOrWhiteSpace(catalogue))
        {
            catalogue = await GetCatalogueSmartFilterAsync(path, readme);
            if (!string.IsNullOrWhiteSpace(catalogue))
            {
                await dbContext.Warehouses.Where(x => x.Id == warehouse.Id)
                    .ExecuteUpdateAsync(x => x.SetProperty(y => y.OptimizedDirectoryStructure, catalogue));
            }
        }

        await dbContext.DocumentCommitRecords.Where(x => x.WarehouseId == warehouse.Id)
            .ExecuteDeleteAsync();

        // 更新ログを生成
        var (git, committer) = await GenerateUpdateLogAsync(document.GitPath, readme,
            warehouse.Address,
            warehouse.Branch,
            kernel);

        await dbContext.DocumentCommitRecords.AddAsync(new DocumentCommitRecord()
        {
            WarehouseId = warehouse.Id,
            CreatedAt = DateTime.Now,
            Author = committer,
            Id = Guid.NewGuid().ToString("N"),
            CommitMessage = git,
            LastUpdate = DateTime.Now,
        });

        if (await dbContext.DocumentOverviews.AnyAsync(x => x.DocumentId == document.Id) == false)
        {
            var overview = await GenerateProjectOverview(fileKernel, catalogue, gitRepository,
                warehouse.Branch, readme);

            // <project_analysis> タグを削除
            var project_analysis = new Regex(@"<project_analysis>(.*?)</project_analysis>",
                RegexOptions.Singleline);
            var project_analysis_match = project_analysis.Match(overview);
            if (project_analysis_match.Success)
            {
                overview = overview.Replace(project_analysis_match.Value, "");
            }

            // <blog> タグの内容を抽出
            var regex = new Regex(@"<blog>(.*?)</blog>",
                RegexOptions.Singleline);
            var match = regex.Match(overview);

            if (match.Success)
            {
                overview = match.Groups[1].Value;
            }

            await dbContext.DocumentOverviews.AddAsync(new DocumentOverview()
            {
                Content = overview,
                Title = "",
                DocumentId = document.Id,
                Id = Guid.NewGuid().ToString("N")
            });
        }

        DocumentResultCatalogue? result = null;
        var retryCount = 0;
        const int maxRetries = 5;
        Exception? exception = null;

        while (retryCount < maxRetries)
        {
            try
            {
                var analysisModel = KernelFactory.GetKernel(OpenAIOptions.Endpoint,
                    OpenAIOptions.ChatApiKey, path, OpenAIOptions.AnalysisModel, false);

                var chat = analysisModel.Services.GetService<IChatCompletionService>();

                StringBuilder str = new StringBuilder();
                var history = new ChatHistory();
                history.AddUserMessage(Prompt.AnalyzeCatalogue
                        .Replace("{{code_files}}", catalogue)
                        .Replace("{{repository_name}}", warehouse.Name));

                await foreach (var item in chat.GetStreamingChatMessageContentsAsync(history,
                                   new OpenAIPromptExecutionSettings()
                                   {
                                       ToolCallBehavior = ToolCallBehavior.RequireFunction(
                                           analysisModel.Plugins["FileFunction"]["ReadFiles"].Metadata
                                               .ToOpenAIFunction(), true),
                                       Temperature = 0.5,
                                       MaxTokens = GetMaxTokens(OpenAIOptions.AnalysisModel)
                                   }, analysisModel))
                {
                    str.Append(item);
                }

                // <documentation_structure> タグの内容を抽出
                var regex = new Regex(@"<documentation_structure>(.*?)</documentation_structure>",
                    RegexOptions.Singleline);
                var match = regex.Match(str.ToString());

                if (match.Success)
                {
                    var extractedContent = match.Groups[1].Value;
                    str.Clear();
                    str.Append(extractedContent);
                }

                // ```json ブロックを抽出
                var jsonRegex = new Regex(@"```json(.*?)```", RegexOptions.Singleline);
                var jsonMatch = jsonRegex.Match(str.ToString());
                if (jsonMatch.Success)
                {
                    var extractedContent = jsonMatch.Groups[1].Value;
                    str.Clear();
                    str.Append(extractedContent);
                }

                try
                {
                    result = JsonConvert.DeserializeObject<DocumentResultCatalogue>(str.ToString().Trim());
                }
                catch (Exception ex)
                {
                    Log.Logger.Error("シリアライズ解除に失敗しました: {ex}, オリジナル文字列: {str}", ex.ToString(), str.ToString().Trim());
                    throw;
                }

                break;
            }
            catch (Exception ex)
            {
                Log.Logger.Warning("リポジトリ {path} の処理, タイトル {name} の処理に失敗しました: {ex}", path, warehouse.Name, ex.ToString());
                exception = ex;
                retryCount++;
                if (retryCount >= maxRetries)
                {
                    Console.WriteLine($"処理 {warehouse.Name} に失敗しました。再試行 {retryCount} 回、エラー: {ex.Message}");
                }
                else
                {
                    await Task.Delay(5000 * retryCount);
                }
            }
        }

        if (result == null)
        {
            throw new Exception("処理失敗: 5回試行しましたが成功しませんでした: " + exception?.Message);
        }

        var documents = new List<DocumentCatalog>();
        ProcessCatalogueItems(result.items, null, warehouse, document, documents);

        documents.ForEach(x => x.IsCompleted = false);

        await dbContext.DocumentCatalogs.Where(x => x.WarehouseId == warehouse.Id)
            .ExecuteDeleteAsync();

        await dbContext.DocumentCatalogs.AddRangeAsync(documents);

        await dbContext.SaveChangesAsync();

        var semaphore = new SemaphoreSlim(TaskMaxSizePerUser);
        var pendingDocuments = new ConcurrentBag<DocumentCatalog>(documents);
        var runningTasks = new List<Task<(DocumentCatalog catalog, DocumentFileItem fileItem, List<string> files)>>();

        while (pendingDocuments.Count > 0 || runningTasks.Count > 0)
        {
            while (pendingDocuments.Count > 0 && runningTasks.Count < TaskMaxSizePerUser)
            {
                if (!pendingDocuments.TryTake(out var documentCatalog)) continue;

                var task = ProcessDocumentAsync(documentCatalog, fileKernel, catalogue, gitRepository,
                    warehouse.Branch, path, semaphore);
                runningTasks.Add(task);
            }

            if (runningTasks.Count == 0)
                break;

            var completedTask = await Task.WhenAny(runningTasks);
            runningTasks.Remove(completedTask);

            try
            {
                var (catalog, fileItem, files) = await completedTask;

                if (fileItem == null)
                {
                    Log.Logger.Error("リポジトリ {path} の処理, タイトル {name} の処理に失敗しました: ファイル内容が空です", path, catalog.Name);
                    throw new Exception("処理失敗: ファイル内容が空です: " + catalog.Name);
                }

                await dbContext.DocumentCatalogs.Where(x => x.Id == catalog.Id)
                    .ExecuteUpdateAsync(x => x.SetProperty(y => y.IsCompleted, true));

                RepairMermaid(fileItem);

                await dbContext.DocumentFileItems.AddAsync(fileItem);
                await dbContext.DocumentFileItemSources.AddRangeAsync(files.Select(x => new DocumentFileItemSource()
                {
                    Address = x,
                    DocumentFileItemId = fileItem.Id,
                    Name = x,
                    Id = Guid.NewGuid().ToString("N"),
                }));

                await dbContext.SaveChangesAsync();

                Log.Logger.Information("リポジトリ {path} の処理, タイトル {name} の処理完了しDBに保存しました！", path, catalog.Name);
            }
            catch (Exception ex)
            {
                Log.Logger.Error("ドキュメント処理に失敗しました: {ex}", ex.ToString());
            }
        }
    }

    /// <summary>
    /// 各項目ごとにファイル内容を生成する
    /// </summary>
    private async Task<(DocumentCatalog catalog, DocumentFileItem fileItem, List<string> files)> ProcessDocumentAsync(
        DocumentCatalog catalog, Kernel kernel, string catalogue, string gitRepository, string branch, string path,
        SemaphoreSlim semaphore)
    {
        int retryCount = 0;
        const int retries = 5;
        var files = new List<string>();
        DocumentContext.DocumentStore = new DocumentStore();

        while (true)
        {
            try
            {
                await semaphore.WaitAsync();
                Log.Logger.Information("リポジトリ {path} の処理, タイトル {name} を開始", path, catalog.Name);
                var fileItem = await ProcessCatalogueItems(catalog, kernel, catalogue, gitRepository, branch, path);
                files.AddRange(DocumentContext.DocumentStore.Files);

                Log.Logger.Information("リポジトリ {path} の処理, タイトル {name} 完了！", path, catalog.Name);
                semaphore.Release();

                return (catalog, fileItem, files);
            }
            catch (Exception ex)
            {
                Log.Logger.Error("リポジトリ {path} の処理, タイトル {name} に失敗しました: {ex}", path, catalog.Name, ex.ToString());
                semaphore.Release();
                retryCount++;
                if (retryCount >= retries)
                {
                    Console.WriteLine($"処理 {catalog.Name} に失敗しました。再試行 {retryCount} 回、エラー: {ex.Message}");
                    throw;
                }
                else
                {
                    await Task.Delay(10000 * retryCount);
                }
            }
        }
    }

    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    public static int GetMaxTokens(string model)
    {
        return model switch
        {
            "deepseek-chat" => 8192,
            "DeepSeek-V3" => 16384,
            "QwQ-32B" => 8192,
            "gpt-4.1-mini" => 16384,
            "gpt-4.1" => 16384,
            "gpt-4o" => 16384,
            "o4-mini" => 16384,
            "doubao-1-5-pro-256k-250115" => 12288,
            "o3-mini" => 16384,
            "Qwen/Qwen3-235B-A22B" => 16384,
            "grok-3" => 65536,
            "qwen3-235b-a22b" => 16384,
            "gemini-2.5-pro-preview-05-06" => 65535,
            _ => 8192
        };
    }

    /// <summary>
    /// Mermaid構文の修正に失敗する場合があるため修復する
    /// </summary>
    private void RepairMermaid(DocumentFileItem fileItem)
    {
        try
        {
            var regex = new Regex(@"```mermaid\s*([\s\S]*?)```", RegexOptions.Multiline);
            var matches = regex.Matches(fileItem.Content);

            foreach (Match match in matches)
            {
                var code = match.Groups[1].Value;
                // [] 内の ( と ) を削除
                var codeWithoutBrackets =
                    Regex.Replace(code, @"\[[^\]]*\]", m => m.Value.Replace("(", "").Replace(")", ""));
                fileItem.Content = fileItem.Content.Replace(match.Value, $"```mermaid\n{codeWithoutBrackets}```");
            }
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Mermaid構文の修正に失敗しました");
        }
    }

    /// <summary>
    /// 更新ログを生成する
    /// </summary>
    public async Task<(string content, string committer)> GenerateUpdateLogAsync(string gitPath,
        string readme, string gitRepositoryUrl, string branch, Kernel kernel)
    {
        // git log を取得
        using var repo = new Repository(gitPath, new RepositoryOptions());

        var log = repo.Commits
            .OrderByDescending(x => x.Committer.When)
            .Take(20)
            .OrderBy(x => x.Committer.When)
            .ToList();

        string commitMessage = string.Empty;
        foreach (var commit in log)
        {
            commitMessage += "コミッター：" + commit.Committer.Name + "\nコミットメッセージ\n<message>\n" + commit.Message +
                             "<message>";
            commitMessage += "\nコミット日時：" + commit.Committer.When.ToString("yyyy-MM-dd HH:mm:ss") + "\n";
        }

        var plugin = kernel.Plugins["CodeAnalysis"]["CommitAnalyze"];

        var str = string.Empty;
        await foreach (var item in kernel.InvokeStreamingAsync(plugin, new KernelArguments()
        {
            ["readme"] = readme,
            ["git_repository"] = gitRepositoryUrl,
            ["commit_message"] = commitMessage,
            ["branch"] = branch
        }))
        {
            str += item;
        }

        var regex = new Regex(@"<changelog>(.*?)</changelog>",
            RegexOptions.Singleline);
        var match = regex.Match(str);

        if (match.Success)
        {
            str = match.Groups[1].Value;
        }

        var lastCommit = log.First();
        return (str, lastCommit.Committer.Name);
    }

    /// <summary>
    /// プロジェクト概要を生成する
    /// </summary>
    private async Task<string> GenerateProjectOverview(Kernel kernel, string catalog, string gitRepository,
        string branch, string readme)
    {
        var sr = new StringBuilder();

        var settings = new OpenAIPromptExecutionSettings()
        {
            ToolCallBehavior = ToolCallBehavior.AutoInvokeKernelFunctions,
        };

        var chat = kernel.GetRequiredService<IChatCompletionService>();
        var history = new ChatHistory();

        history.AddUserMessage(Prompt.Overview.Replace("{{catalogue}}", catalog)
            .Replace("{{git_repository}}", gitRepository)
            .Replace("{{readme}}", readme)
            .Replace("{{branch}}", branch));

        await foreach (var item in chat.GetStreamingChatMessageContentsAsync(history, settings, kernel))
        {
            if (!string.IsNullOrEmpty(item.Content))
            {
                sr.Append(item.Content);
            }
        }

        var regex = new Regex(@"<blog>(.*?)</blog>", RegexOptions.Singleline);
        var match = regex.Match(sr.ToString());

        if (match.Success)
        {
            var extractedContent = match.Groups[1].Value;
            sr.Clear();
            sr.Append(extractedContent);
        }

        return sr.ToString();
    }

    /// <summary>
    /// 全ファイルを走査し、ファイル内容を生成する
    /// </summary>
    private async Task<DocumentFileItem> ProcessCatalogueItems(DocumentCatalog catalog, Kernel kernel, string catalogue,
        string gitRepository, string branch, string path)
    {
        var chat = kernel.Services.GetService<IChatCompletionService>();

        var history = new ChatHistory();

        history.AddUserMessage(Prompt.GenerateDocs
            .Replace("{{catalogue}}", catalogue)
            .Replace("{{prompt}}", catalog.Prompt)
            .Replace("{{git_repository}}", gitRepository)
            .Replace("{{branch}}", branch)
            .Replace("{{title}}", catalog.Name));

        var fileFunction = new FileFunction(path);
        history.AddUserMessage(await fileFunction.ReadFilesAsync(catalog.DependentFile.ToArray()));

        var sr = new StringBuilder();

        await foreach (var i in chat.GetStreamingChatMessageContentsAsync(history, new OpenAIPromptExecutionSettings()
        {
            ToolCallBehavior = ToolCallBehavior.AutoInvokeKernelFunctions,
            MaxTokens = GetMaxTokens(OpenAIOptions.ChatModel),
            Temperature = 0.5,
        }, kernel))
        {
            if (!string.IsNullOrEmpty(i.Content))
            {
                sr.Append(i.Content);
            }
        }

        // <thought_process> タグ内容を抽出
        var thought_process = new Regex(@"<thought_process>(.*?)</thought_process>", RegexOptions.Singleline);
        var thought_process_match = thought_process.Match(sr.ToString());
        if (thought_process_match.Success)
        {
            var extractedContent = thought_process_match.Groups[1].Value;
            sr.Clear();
            sr.Append(extractedContent);
        }

        // <data-blog> タグ内容を抽出
        var regex = new Regex(@"<data-blog>(.*?)</data-blog>", RegexOptions.Singleline);
        var match = regex.Match(sr.ToString());

        if (match.Success)
        {
            var extractedContent = match.Groups[1].Value;
            sr.Clear();
            sr.Append(extractedContent);
        }

        var fileItem = new DocumentFileItem()
        {
            Content = sr.ToString(),
            DocumentCatalogId = catalog.Id,
            Description = string.Empty,
            Extra = new Dictionary<string, string>(),
            Metadata = new Dictionary<string, string>(),
            Source = [],
            CommentCount = 0,
            RequestToken = 0,
            CreatedAt = DateTime.Now,
            Id = Guid.NewGuid().ToString("N"),
            ResponseToken = 0,
            Size = 0,
            Title = catalog.Name,
        };

        return fileItem;
    }

    private static void ProcessCatalogueItems(List<DocumentResultCatalogueItem> items, string? parentId,
        Warehouse warehouse,
        Document document, List<DocumentCatalog>? documents)
    {
        int order = 0; // ソート順カウンタを作成
        foreach (var item in items)
        {
            item.title = item.title.Replace(" ", "");
            var documentItem = new DocumentCatalog
            {
                WarehouseId = warehouse.Id,
                Description = item.title,
                DependentFile = item.dependent_file.ToList(),
                Id = Guid.NewGuid() + item.title,
                Name = item.name,
                Url = item.title,
                DucumentId = document.Id,
                ParentId = parentId,
                Prompt = item.prompt,
                Order = order++ // 同階層の各項目に順序値を設定してインクリメント
            };

            documents.Add(documentItem);

            ProcessCatalogueItems(item.children.ToList(), documentItem.Id, warehouse, document,
                documents);
        }
    }

    /// <summary>
    /// リポジトリの ReadMe ファイルを読み込む
    /// </summary>
    public static async Task<string> ReadMeFile(string path)
    {
        var readmePath = Path.Combine(path, "README.md");
        if (File.Exists(readmePath))
        {
            return await File.ReadAllTextAsync(readmePath);
        }

        readmePath = Path.Combine(path, "README.txt");
        if (File.Exists(readmePath))
        {
            return await File.ReadAllTextAsync(readmePath);
        }

        readmePath = Path.Combine(path, "README");
        if (File.Exists(readmePath))
        {
            return await File.ReadAllTextAsync(readmePath);
        }

        return string.Empty;
    }

    /// <summary>
    /// ディレクトリを再帰スキャンし、PathInfo リストを構築する
    /// </summary>
    static void ScanDirectory(string directoryPath, List<PathInfo> infoList, string[] ignoreFiles)
    {
        // 全ファイルを走査
        infoList.AddRange(from file in Directory.GetFiles(directoryPath).Where(file =>
            {
                var filename = Path.GetFileName(file);

                // ワイルドカードマッチをサポート
                foreach (var pattern in ignoreFiles)
                {
                    if (string.IsNullOrWhiteSpace(pattern) || pattern.StartsWith("#"))
                        continue;

                    var trimmedPattern = pattern.Trim();

                    // gitignore パターンを正規表現に変換
                    if (trimmedPattern.Contains('*'))
                    {
                        string regexPattern = "^" + Regex.Escape(trimmedPattern).Replace("\\*", ".*") + "$";
                        if (Regex.IsMatch(filename, regexPattern, RegexOptions.IgnoreCase))
                            return false;
                    }
                    else if (filename.Equals(trimmedPattern, StringComparison.OrdinalIgnoreCase))
                    {
                        return false;
                    }
                }

                // 1MB を超えるファイルを除外
                var fileInfo = new FileInfo(file);
                return fileInfo.Length < 1024 * 1024 * 1;
            })
                          select new PathInfo { Path = file, Name = Path.GetFileName(file), Type = "File" });

        // サブディレクトリを再帰スキャン
        foreach (var directory in Directory.GetDirectories(directoryPath))
        {
            var dirName = Path.GetFileName(directory);

            // . で始まるディレクトリを除外
            if (dirName.StartsWith("."))
                continue;

            bool shouldIgnore = false;
            foreach (var pattern in ignoreFiles)
            {
                if (string.IsNullOrWhiteSpace(pattern) || pattern.StartsWith("#"))
                    continue;

                var trimmedPattern = pattern.Trim();
                bool directoryPattern = trimmedPattern.EndsWith("/");
                if (directoryPattern)
                    trimmedPattern = trimmedPattern.TrimEnd('/');

                // gitignore パターンを正規表現に変換
                if (trimmedPattern.Contains('*'))
                {
                    string regexPattern = "^" + Regex.Escape(trimmedPattern).Replace("\\*", ".*") + "$";
                    if (Regex.IsMatch(dirName, regexPattern, RegexOptions.IgnoreCase))
                    {
                        shouldIgnore = true;
                        break;
                    }
                }
                else if (dirName.Equals(trimmedPattern, StringComparison.OrdinalIgnoreCase))
                {
                    shouldIgnore = true;
                    break;
                }
            }

            if (shouldIgnore)
                continue;

            ScanDirectory(directory, infoList, ignoreFiles);
        }
    }
}
