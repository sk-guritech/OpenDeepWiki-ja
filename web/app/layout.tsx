import { AntdRegistry } from '@ant-design/nextjs-registry';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import './globals.css';
import '@ant-design/v5-patch-for-react-19';
import Script from 'next/script';
import { Metadata } from 'next';

// 设置基础元数据
export const metadata: Metadata = {
  title: {
    template: '%s | OpenDeekWiki',
    default: 'OpenDeekWiki - 开源知识管理平台',
  },
  description: 'KoalaWiki是一个功能强大的开源知识库和文档管理平台，帮助团队高效管理和共享技术文档、API文档和知识资源。',
  keywords: ['OpenDeekWiki', '知识库', '文档管理', '技术文档', 'API文档', '开源'],
  authors: [{ name: 'OpenDeekWiki Team' }],
  creator: 'OpenDeekWiki',
  publisher: 'OpenDeekWiki',
  formatDetection: {
    telephone: false,
  },
  metadataBase: new URL('https://opendeep.wiki'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'OpenDeekWiki - 开源知识管理平台',
    description: 'KoalaWiki是一个功能强大的开源知识库和文档管理平台，帮助团队高效管理和共享技术文档、API文档和知识资源。',
    url: 'https://opendeep.wiki',
    siteName: 'OpenDeekWiki',
    locale: 'zh_CN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OpenDeekWiki - 开源知识管理平台',
    description: 'KoalaWiki是一个功能强大的开源知识库和文档管理平台，帮助团队高效管理和共享技术文档、API文档和知识资源。',
    creator: '@OpenDeekWiki',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
  },
  verification: {
    google: 'google-site-verification-code',
    other: {
      'baidu-site-verification': '44a79feb3bf1e77660bdbc00e1808896',
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 从环境变量NEXT_PUBLIC_API_URL读取
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || '';

  return (
    <html lang="ja">
      <head>
        <meta name="msvalidate.01" content="61D1D1BFCB7FDB548E411C30FC69B058" />
        <meta name="baidu-site-verification" content="44a79feb3bf1e77660bdbc00e1808896" />
        <link rel="icon" href="/favicon.ico" />
        <Script >
          {`
            var _hmt = _hmt || [];
            (function() {
              var hm = document.createElement("script");
              hm.src = "https://hm.baidu.com/hm.js?44a79feb3bf1e77660bdbc00e1808896";
              var s = document.getElementsByTagName("script")[0]; 
              s.parentNode.insertBefore(hm, s);
            })();
          `}
        </Script>
      </head>
      <body >
        <Script id="api-url"
          type="text/javascript"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              console.log('API_URL', '${apiUrl}');
              window.API_URL = '${apiUrl}';
              `
          }}
        />


        <AntdRegistry>
          <ConfigProvider
            locale={zhCN}
            theme={{
              token: {
                colorPrimary: '#1677ff',
              },
              algorithm: theme.defaultAlgorithm,
            }}
          >
            {children}
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  )
}