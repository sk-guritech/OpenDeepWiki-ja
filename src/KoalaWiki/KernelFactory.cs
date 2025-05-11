using System.ClientModel;
using System.Collections.Concurrent;
using KoalaWiki.Functions;
using KoalaWiki.Options;
using KoalaWiki.plugins;
using Microsoft.SemanticKernel;
using OpenAI;
using Serilog;

#pragma warning disable SKEXP0070
#pragma warning disable SKEXP0010

namespace KoalaWiki;

/// <summary>
/// AIベースの操作を行うためのカーネルインスタンスを作成および構成する静的メソッドを提供します。  
/// KernelFactoryクラスは、チャット完了サービス、ログ記録、ファイル処理機能など、  
/// カーネルに必要なサービス、プラグイン、および設定を設定します。  
/// 複数のAIモデルプロバイダーに対応し、オプションでコード分析機能を提供します。  
/// </summary>
public static class KernelFactory
{
    public static Kernel GetKernel(string chatEndpoint,
        string apiKey,
        string gitPath,
        string model = "gpt-4.1", bool isCodeAnalysis = true)
    {
        var kernelBuilder = Kernel.CreateBuilder();

        kernelBuilder.Services.AddSerilog(Log.Logger);

        kernelBuilder.Services.AddSingleton<IPromptRenderFilter, LanguagePromptFilter>();

        if (OpenAIOptions.ModelProvider.Equals("OpenAI", StringComparison.OrdinalIgnoreCase))
        {
            kernelBuilder.AddOpenAIChatCompletion(model, new Uri(chatEndpoint), apiKey,
                httpClient: new HttpClient(new KoalaHttpClientHandler()
                {
                    // リトライを追加
                    AllowAutoRedirect = true,
                    MaxAutomaticRedirections = 5,
                    MaxConnectionsPerServer = 200,
                })
                {
                    // リトライを追加
                    Timeout = TimeSpan.FromSeconds(16000),
                });
        }
        else if (OpenAIOptions.ModelProvider.Equals("AzureOpenAI", StringComparison.OrdinalIgnoreCase))
        {
            kernelBuilder.AddAzureOpenAIChatCompletion(model, chatEndpoint, apiKey, httpClient: new HttpClient(
                new KoalaHttpClientHandler()
                {
                    // リトライを追加
                    AllowAutoRedirect = true,
                    MaxAutomaticRedirections = 5,
                    MaxConnectionsPerServer = 200,
                })
            {
                // リトライを追加
                Timeout = TimeSpan.FromSeconds(16000),
            });
        }
        else if (OpenAIOptions.ModelProvider.Equals("Anthropic", StringComparison.OrdinalIgnoreCase))
        {
            kernelBuilder.AddAnthropicChatCompletion(model, apiKey, httpClient: new HttpClient(
                new KoalaHttpClientHandler()
                {
                    // リトライを追加
                    AllowAutoRedirect = true,
                    MaxAutomaticRedirections = 5,
                    MaxConnectionsPerServer = 200,
                })
            {
                // リトライを追加
                Timeout = TimeSpan.FromSeconds(16000),
            });
        }
        else
        {
            throw new Exception("現在は " + OpenAIOptions.ModelProvider + " はサポートされていません。OpenAI、AzureOpenAI、Anthropic を使用してください。");
        }

        if (isCodeAnalysis)
        {
            kernelBuilder.Plugins.AddFromPromptDirectory(Path.Combine(AppContext.BaseDirectory, "plugins",
                "CodeAnalysis"));
        }

        // ファイル処理機能を追加
        var fileFunction = new FileFunction(gitPath);
        kernelBuilder.Plugins.AddFromObject(fileFunction);

        var kernel = kernelBuilder.Build();

        return kernel;
    }
}
