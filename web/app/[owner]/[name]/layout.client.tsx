'use client'
import {
  Layout,
  Typography,
  Space,
  theme,
  ConfigProvider,
  Flex,
  Breadcrumb,
  Divider,
  Button,
  Modal,
  Card,
  message,
  Tooltip,
  Steps,
  Collapse,
  Alert,
  Progress,
} from 'antd';
import {
  HomeOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ApiOutlined,
  CopyOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import AIInputBar from '../../components/AIInputBar';
import Image from 'next/image';

const { Header, Content, Sider, Footer } = Layout;
const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

interface DocumentCatalogResponse {
  key: string;
  label: string;
  url: string;
  order: number;
  disabled: boolean;
  children?: DocumentCatalogResponse[];
}

interface RepositoryLayoutClientProps {
  owner: string;
  name: string;
  initialCatalogData: any;
  initialLastUpdated: string;
  children: React.ReactNode;
}

export default function RepositoryLayoutClient({
  owner,
  name,
  initialCatalogData,
  initialLastUpdated,
  children,
}: RepositoryLayoutClientProps) {
  const pathname = usePathname();
  const { token } = theme.useToken();

  const pathParts = pathname.split('/').filter(Boolean);
  const currentPath = pathParts.slice(2).join('/');

  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isMCPModalVisible, setIsMCPModalVisible] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const selectedKey = pathname.includes('/') ? 'docs' : 'overview';

  // Check if the screen size is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // Automatically collapse sidebar on mobile
  useEffect(() => {
    if (isMobile) {
      setCollapsed(true);
    }
  }, [isMobile]);

  const mcpConfigJson = {
    mcpServers: {
      [name]: {
        url: `${window.location.protocol}//${window.location.host}/api/sse?owner=${owner}&name=${name}`
      }
    }
  };

  const mcpJsonString = JSON.stringify(mcpConfigJson, null, 2);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(mcpJsonString)
      .then(() => {
        setCopySuccess(true);
        message.success('設定をクリップボードにコピーしました');
        setTimeout(() => setCopySuccess(false), 3000);
      })
      .catch(() => {
        message.error('コピーに失敗しました。手動でコピーしてください');
      });
  };

  const renderSidebarItem = (item: DocumentCatalogResponse, level = 0) => {
    const isActive = pathname.includes(`/${item.url}`);

    const style = {
      padding: `${token.paddingXS}px ${token.paddingLG}px`,
      paddingLeft: `${token.paddingLG + level * token.paddingMD}px`,
      color: isActive ? token.colorPrimary : token.colorText,
      cursor: 'pointer',
      backgroundColor: isActive ? token.colorBgTextActive : 'transparent',
      transition: `all ${token.motionDurationMid}`,
      display: 'flex',
      alignItems: 'center',
      textDecoration: 'none',
      fontWeight: isActive ? 500 : 400,
      margin: `5px 0`,
      borderRadius: token.borderRadiusLG,
      fontSize: token.fontSizeSM,
      lineHeight: token.lineHeight,
    };

    return (
      <div key={item.key}>
        {item.children?.length ? (
          <>
            {item.disabled ? (
              <div
                style={{
                  ...style,
                  color: token.colorTextDisabled,
                  backgroundColor: 'transparent',
                  cursor: 'not-allowed',
                }}
              >
                <span>{item.label}</span>
              </div>
            ) : (
              <Link
                href={`/${owner}/${name}/${item.url}`}
                style={style}>
                <span>{item.label}</span>
              </Link>
            )}
            {item.children.sort((a, b) => a.order - b.order).map(child =>
              renderSidebarItem(child, level + 1)
            )}
          </>
        ) : (
          item.disabled ? (
            <div
              style={{
                ...style,
                color: token.colorTextDisabled,
                backgroundColor: 'transparent',
                cursor: 'not-allowed',
              }}
            >
              <span>{item.label}</span>
            </div>
          ) : (
            <Link
              href={`/${owner}/${name}/${item.url}`}
              style={style}
            >
              <span>{item.label}</span>
            </Link>
          )
        )}
      </div>
    );
  };

  const generateBreadcrumb = () => {
    const items = [
      {
        title: <Link href="/"><HomeOutlined /></Link>,
      },
      {
        title: <Link href={`/${owner}`}>{owner}</Link>,
      },
      {
        title: <Link href={`/${owner}/${name}`}>{name}</Link>,
      }
    ];

    if (currentPath) {
      items.push({
        title: <span>{currentPath}</span>,
      });
    }

    return items;
  };
  console.log(initialCatalogData);

  return (
    <ConfigProvider
      theme={{
        components: {
          Layout: {
            headerBg: token.colorBgElevated,
            siderBg: token.colorBgContainer,
            bodyBg: token.colorBgLayout,
          },
          FloatButton: {
            colorPrimary: token.colorPrimary,
          }
        },
      }}
    >
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{
          padding: `0 ${token.paddingLG}px`,
          background: token.colorBgContainer,
          position: 'fixed',
          width: '100%',
          zIndex: 1000,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          boxShadow: token.boxShadowSecondary
        }}>
          <Flex align="center" justify="space-between" style={{ height: '100%' }}>
            <Flex align="center" gap={token.marginXS}>
              <Link href="/">
                <span
                  style={{
                    color: token.colorPrimary,
                    fontSize: token.fontSizeLG,
                    fontWeight: 600,
                    fontFamily: "'Montserrat', sans-serif",
                    letterSpacing: '0.5px',
                    cursor: 'pointer',
                    transition: `color ${token.motionDurationMid}`,
                    textShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    // @ts-ignore
                    '&:hover': {
                      color: token.colorPrimaryHover,
                    }
                  }}
                >
                  OpenDeepWiki
                </span>
              </Link>

              <Typography.Title
                level={4}
                style={{
                  margin: 0,
                  fontSize: isMobile ? token.fontSizeHeading5 : token.fontSizeHeading4,
                  lineHeight: 1.2,
                  cursor: initialCatalogData?.git ? 'pointer' : 'default',
                }}
              >
                <Flex align="center" wrap={isMobile ? "wrap" : "nowrap"}>
                  <span
                    onClick={() => {
                      if (initialCatalogData?.git) {
                        window.open(initialCatalogData.git, '_blank');
                      }
                    }}
                    style={{
                      color: token.colorText,
                      fontSize: isMobile ? token.fontSizeLG : token.fontSizeHeading5,
                      lineHeight: 1.2,
                      cursor: 'pointer',
                      marginRight: token.marginXS,
                    }}>
                    {owner}/{name}
                  </span>
                </Flex>
              </Typography.Title>
              {initialCatalogData?.progress !== undefined && initialCatalogData?.progress < 100 && (
                <Flex align="center" gap={token.marginXS}>
                  <Progress
                    percent={initialCatalogData?.progress || 0}
                    size="small"
                    style={{
                      width: '80px',
                      margin: 0
                    }}
                    showInfo={false}
                  />
                  <span>
                    {initialCatalogData?.progress}%
                  </span>
                </Flex>
              )}
            </Flex>

            <Flex align="center" gap={token.marginSM}>
              <Button
                type="primary"
                icon={<ApiOutlined />}
                onClick={() => setIsMCPModalVisible(true)}
                size={isMobile ? "small" : "middle"}
              >
                MCPを追加
              </Button>
              {initialLastUpdated && (
                <Text type="secondary" style={{
                  fontSize: token.fontSizeSM,
                  fontWeight: 500,
                  display: isMobile ? 'none' : 'block'
                }}>
                  最近更新: {initialLastUpdated}
                </Text>
              )}
            </Flex>
          </Flex>
        </Header>
        <Modal
          title={
            <Flex align="center" gap={token.marginXS}>
              <ApiOutlined style={{ color: token.colorPrimary }} />
              <span>MCP接続チュートリアル</span>
            </Flex>
          }
          open={isMCPModalVisible}
          onCancel={() => setIsMCPModalVisible(false)}
          footer={null}
          width={700}
          centered
        >
          <Flex vertical gap={token.marginMD}>
            <Alert
              type="info"
              showIcon
              message="OpenDeepWikiはMCP（ModelContextProtocol）をサポートします"
              description={
                <ul style={{ paddingLeft: token.paddingLG, margin: `${token.marginXS}px 0` }}>
                  <li>MCPサーバーをリポジトリ単位で提供し、個別リポジトリの解析を可能にします</li>
                  <li>OpenDeepWikiをMCPサーバーとして使用することで、オープンソースプロジェクトの解析と理解が容易になります</li>
                </ul>
              }
              style={{ marginBottom: token.marginMD }}
            />

            <Card
              title="設定の使用方法"
              style={{ marginBottom: token.marginMD }}
            >
              <Paragraph style={{ marginBottom: token.marginSM }}>
                以下はCursorの使用方法です：
              </Paragraph>

              <div style={{
                position: 'relative',
                backgroundColor: token.colorBgLayout,
                padding: token.paddingMD,
                borderRadius: token.borderRadiusLG,
                marginBottom: token.marginMD
              }}>
                <pre style={{
                  margin: 0,
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {mcpJsonString}
                </pre>
                <Tooltip title={copySuccess ? "コピー済み" : "設定をコピー"}>
                  <Button
                    type="text"
                    icon={copySuccess ? <CheckOutlined style={{ color: token.colorSuccess }} /> : <CopyOutlined />}
                    onClick={copyToClipboard}
                    style={{
                      position: 'absolute',
                      top: token.paddingXS,
                      right: token.paddingXS
                    }}
                  />
                </Tooltip>
              </div>

              <Flex vertical gap={token.marginSM}>
                <Text strong>設定説明：</Text>
                <ul style={{ paddingLeft: token.paddingLG, margin: 0 }}>
                  <li><Text code>owner</Text>：リポジトリの組織または所有者の名前です</li>
                  <li><Text code>name</Text>：リポジトリの名前です</li>
                </ul>
              </Flex>
            </Card>

            <Card
              title="テストケース"
            >
              <Paragraph>
                リポジトリを追加した後、テスト質問を試してください（注意：リポジトリが処理済みであることを確認してください）：
              </Paragraph>
              <Paragraph strong style={{ color: token.colorPrimary }}>
                OpenDeepWikiとは？
              </Paragraph>
              <div style={{
                width: '100%',
                height: 'auto',
                position: 'relative',
                marginTop: token.marginMD,
                borderRadius: token.borderRadiusLG,
                overflow: 'hidden',
                border: `1px solid ${token.colorBorderSecondary}`
              }}>
                <img
                  src="/mcp.png"
                  alt="MCPテスト結果"
                  style={{
                    width: '100%',
                    height: 'auto',
                    display: 'block',
                    objectFit: 'contain'
                  }}
                />
              </div>
            </Card>
          </Flex>
        </Modal>

        <Layout
          className={initialCatalogData?.items?.length > 0 ? 'ant-layout-content' : 'ant-layout-content-mobile'}
          style={{
            marginTop: 64,
          }}>
          {initialCatalogData?.items?.length > 0 ? (
            <Sider
              width={260}
              collapsible
              collapsed={collapsed}
              onCollapse={setCollapsed}
              trigger={null}
              breakpoint="lg"
              collapsedWidth={isMobile ? 0 : 80}
              style={{
                background: token.colorBgContainer,
                overflow: 'auto',
                height: 'calc(100vh - 64px)',
                position: 'fixed',
                left: 0,
                top: 64,
                bottom: 0,
                borderRight: `1px solid ${token.colorBorderSecondary}`,
                transition: `all ${token.motionDurationMid}`,
                boxShadow: isMobile && !collapsed ? token.boxShadowSecondary : 'none',
              }}
            >
              <div style={{ padding: `${token.paddingMD}px 0` }}>
                <Flex
                  align="center"
                  justify="space-between"
                  style={{
                    padding: `0 ${token.paddingXS}px ${token.paddingXS}px`,
                    marginBottom: token.marginXS
                  }}
                >
                  <Flex align="center">
                    <Button
                      type="text"
                      icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                      onClick={() => setCollapsed(!collapsed)}
                      style={{
                        fontSize: token.fontSizeLG,
                        marginLeft: token.marginXS
                      }}
                    />
                  </Flex>
                </Flex>
                <Flex
                  vertical
                  style={{ padding: `0 ${token.paddingXS}px` }}
                >
                  <Link
                    href={`/${owner}/${name}`}
                    style={{
                      padding: `${token.paddingXS}px ${token.paddingLG}px`,
                      color: pathname === `/${owner}/${name}` ? token.colorPrimary : token.colorText,
                      backgroundColor: pathname === `/${owner}/${name}` ? token.colorBgTextActive : 'transparent',
                      fontWeight: pathname === `/${owner}/${name}` ? 500 : 400,
                      display: 'flex',
                      alignItems: 'center',
                      textDecoration: 'none',
                      borderRadius: token.borderRadiusLG,
                      marginBottom: token.marginXS,
                      transition: `all ${token.motionDurationMid}`,
                    }}
                  >
                    <HomeOutlined style={{ marginRight: token.marginXS }} />
                    <span>概要</span>
                  </Link>

                  <Divider style={{ margin: `0`, padding: '0' }} />

                  {initialCatalogData?.items?.map(item => renderSidebarItem(item))}

                  <Link
                    href={`/${owner}/${name}/changelog`}
                    style={{
                      padding: `${token.paddingXS}px ${token.paddingLG}px`,
                      color: pathname === `/${owner}/${name}/changelog` ? token.colorPrimary : token.colorText,
                      backgroundColor: pathname === `/${owner}/${name}/changelog` ? token.colorBgTextActive : 'transparent',
                      fontWeight: pathname === `/${owner}/${name}/changelog` ? 500 : 400,
                      display: 'flex',
                      alignItems: 'center',
                      textDecoration: 'none',
                      borderRadius: token.borderRadiusLG,
                      marginBottom: token.marginXS,
                    }}
                  >
                    <span>更新履歴</span>
                  </Link>
                </Flex>
              </div>
            </Sider>) : (
            <></>
          )}

          <Content style={{
            marginLeft: collapsed ? 0 : 260,
            padding: token.paddingLG,
            background: token.colorBgContainer,
            minHeight: 'calc(100vh - 64px)',
            transition: `all ${token.motionDurationMid}`,
            position: 'relative',
          }}>
            {collapsed && (
              <Button
                type="text"
                icon={<MenuUnfoldOutlined />}
                onClick={() => setCollapsed(false)}
                style={{
                  position: 'fixed',
                  left: token.marginXS,
                  top: 72,
                  zIndex: 999,
                  fontSize: token.fontSizeLG,
                  background: token.colorBgContainer,
                  borderRadius: token.borderRadiusLG,
                  boxShadow: token.boxShadowSecondary,
                  width: 40,
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              />
            )}
            <Breadcrumb
              items={generateBreadcrumb()}
              style={{
                marginBottom: token.paddingLG,
                fontSize: token.fontSizeSM
              }}
            />

            <div style={{
              background: token.colorBgContainer,
              padding: token.paddingLG,
              borderRadius: token.borderRadiusLG,
              boxShadow: token.boxShadowTertiary
            }}>
              {children}
            </div>
          </Content>
        </Layout>

        <Footer style={{
          textAlign: 'center',
          background: token.colorBgContainer,
          padding: `${token.paddingSM}px ${token.paddingLG}px`,
          marginTop: 'auto',
          borderTop: `1px solid ${token.colorBorderSecondary}`
        }}>
          <Space direction="vertical" size={token.sizeXS}>
            <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              Powered by OpenDeepWiki
            </Text>
            <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              Powered by .NET 9.0
            </Text>
          </Space>
        </Footer>
      </Layout>
      {initialCatalogData?.items?.length > 0 && (
        <AIInputBar
          owner={owner}
          name={name}
          style={{
            position: 'fixed',
            bottom: token.marginLG,
            left: 0,
            right: 0,
            margin: '0 auto',
            maxWidth: isMobile ? '80%' : '70%',
            width: isMobile ? 'calc(100% - 32px)' : 'auto',
            zIndex: 1001,
            boxShadow: token.boxShadowSecondary,
            borderRadius: token.borderRadiusLG,
          }}
        />
      )}
    </ConfigProvider>
  );
}
