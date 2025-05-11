'use client'

import { useEffect, useState } from 'react';
import { Row, Col, Typography, Tag, Button, Skeleton, Avatar, theme, Divider, message } from 'antd';
import { StarOutlined, ForkOutlined, CalendarOutlined, ExclamationCircleOutlined, EyeOutlined, IssuesCloseOutlined, PlusOutlined } from '@ant-design/icons';
import Link from 'next/link';

interface GitHubRepoInfo {
  html_url: string;
  description: string;
  stargazers_count: number;
  forks_count: number;
  language: string;
  updated_at: string;
  owner: {
    avatar_url: string;
    html_url: string;
    login: string;
  };
  license?: {
    name: string;
  };
  default_branch: string;
  topics: string[];
  open_issues_count: number;
  visibility: string;
}

import RepositoryForm from '../../components/RepositoryForm';
import { submitWarehouse } from '../../services';
import { RepositoryFormValues } from '../../types';

const { Title, Paragraph } = Typography;
const { useToken } = theme;

interface RepositoryInfoProps {
  owner: string;
  name: string;
}

export default function RepositoryInfo({ owner, name }: RepositoryInfoProps) {
  const { token } = useToken();
  const [repoInfo, setRepoInfo] = useState<GitHubRepoInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readme, setReadme] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);

  useEffect(() => {
    async function fetchGitHubRepo() {
      try {
        setLoading(true);

        const response = await fetch(`https://api.github.com/repos/${owner}/${name}`);

        if (!response.ok) {
          throw new Error('GitHubリポジトリ情報の取得に失敗しました');
        }

        const data = await response.json();
        setRepoInfo(data);

        // README内容を取得
        try {
          const readmeResponse = await fetch(`https://api.github.com/repos/${owner}/${name}/readme`, {
            headers: {
              'Accept': 'application/vnd.github.html'
            }
          });

          if (readmeResponse.ok) {
            const readmeHtml = await readmeResponse.text();
            setReadme(readmeHtml);
          }
        } catch (readmeErr) {
          console.error('READMEの取得に失敗しました:', readmeErr);
          // README取得失敗はメインフローに影響しない
        }

        setError(null);
      } catch (err) {
        console.error('GitHubリポジトリ情報の取得中にエラーが発生しました:', err);
        setError('GitHubリポジトリ情報を取得できませんでした');
      } finally {
        setLoading(false);
      }
    }

    if (owner && name) {
      fetchGitHubRepo();
    }
  }, [owner, name]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const handleAddRepository = async (values: RepositoryFormValues) => {
    try {
      const response = await submitWarehouse(values);
      if (response.success) {
        message.success('リポジトリの追加に成功しました');
        // 最新データ取得のためリロード
        window.location.reload();
      } else {
        message.error('リポジトリの追加に失敗しました: ' + (response.error || '不明なエラー'));
      }
    } catch (error) {
      console.error('リポジトリ追加中にエラーが発生しました:', error);
      message.error('リポジトリの追加中にエラーが発生しました。後ほどお試しください');
    }
    setFormVisible(false);
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {loading ? (
          <Skeleton active avatar paragraph={{ rows: 4 }} />
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <ExclamationCircleOutlined style={{ fontSize: '48px', color: token.colorError, marginBottom: '16px' }} />
            <Title level={4} style={{ marginBottom: '16px' }}>リポジトリがインデックスされていません</Title>
            <Paragraph type="secondary">
              {`${owner}/${name} — ${error}`}
            </Paragraph>
            <Button type="primary" href={`https://github.com/${owner}/${name}`} target="_blank">
              GitHubで表示
            </Button>
          </div>
        ) : repoInfo && (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap' }}>
              <Avatar
                src={repoInfo.owner.avatar_url}
                alt={owner}
                size={64}
                style={{ marginRight: '16px' }}
              />
              <div style={{ flex: 1, minWidth: '280px' }}>
                <Title level={3} style={{ margin: 0 }}>
                  <Link
                    href={repoInfo.html_url}
                    target="_blank"
                    style={{ color: token.colorText }}
                  >
                    {owner}/{name}
                  </Link>
                </Title>
                {repoInfo.description && (
                  <Paragraph style={{ margin: '8px 0 0', color: token.colorTextSecondary }}>
                    {repoInfo.description}
                  </Paragraph>
                )}
              </div>
              <div style={{ display: 'flex', marginTop: { xs: '16px', sm: '16px', md: '0' }[token.screenSM], flexWrap: 'wrap' }}>
                <Button
                  type="primary"
                  href={`https://github.com/${owner}/${name}`}
                  target="_blank"
                  style={{ marginRight: '12px', marginBottom: '8px' }}
                  icon={<EyeOutlined />}
                >
                  GitHubで表示
                </Button>
                <Button
                  type="default"
                  onClick={() => setFormVisible(true)}
                  style={{ marginBottom: '8px' }}
                  icon={<PlusOutlined />}
                >
                  リポジトリを追加
                </Button>
              </div>
            </div>

            <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
              <Col>
                <Tag color={token.colorPrimary} icon={<StarOutlined />}>
                  {repoInfo.stargazers_count} スター
                </Tag>
              </Col>
              <Col>
                <Tag color={token.colorSuccess} icon={<ForkOutlined />}>
                  {repoInfo.forks_count} フォーク
                </Tag>
              </Col>
              {repoInfo.open_issues_count > 0 && (
                <Col>
                  <Tag color={token.colorWarning} icon={<IssuesCloseOutlined />}>
                    {repoInfo.open_issues_count} イシュー
                  </Tag>
                </Col>
              )}
              {repoInfo.language && (
                <Col>
                  <Tag color={token.colorInfo}>
                    {repoInfo.language}
                  </Tag>
                </Col>
              )}
              {repoInfo.license && (
                <Col>
                  <Tag color={token.colorWarning}>
                    {repoInfo.license.name}
                  </Tag>
                </Col>
              )}
              <Col>
                <Tag color={token.colorTextSecondary} icon={<CalendarOutlined />}>
                  最終更新: {formatDate(repoInfo.updated_at)}
                </Tag>
              </Col>
              {repoInfo.topics && repoInfo.topics.length > 0 && (
                repoInfo.topics.slice(0, 3).map(topic => (
                  <Col key={topic}>
                    <Tag color={token.colorPrimaryBg}>{topic}</Tag>
                  </Col>
                ))
              )}
            </Row>

            {readme && (
              <>
                <Divider />
                <div
                  className="github-readme"
                  dangerouslySetInnerHTML={{ __html: readme }}
                  style={{
                    overflow: 'auto',
                    padding: '0 8px'
                  }}
                />
                <style jsx global>{`
                    .github-readme {
                      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
                      font-size: 16px;
                      line-height: 1.5;
                      word-wrap: break-word;
                    }
                    .github-readme h1,
                    .github-readme h2,
                    .github-readme h3,
                    .github-readme h4,
                    .github-readme h5,
                    .github-readme h6 {
                      margin-top: 24px;
                      margin-bottom: 16px;
                      font-weight: 600;
                      line-height: 1.25;
                    }
                    .github-readme h1 {
                      font-size: 2em;
                      border-bottom: 1px solid #eaecef;
                      padding-bottom: 0.3em;
                    }
                    .github-readme h2 {
                      font-size: 1.5em;
                      border-bottom: 1px solid #eaecef;
                      padding-bottom: 0.3em;
                    }
                    .github-readme a {
                      color: ${token.colorPrimary};
                      text-decoration: none;
                    }
                    .github-readme a:hover {
                      text-decoration: underline;
                    }
                    .github-readme img {
                      max-width: 100%;
                    }
                    .github-readme pre {
                      background-color: #f6f8fa;
                      border-radius: 6px;
                      padding: 16px;
                      overflow: auto;
                    }
                    .github-readme code {
                      font-family: SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;
                      font-size: 85%;
                      background-color: rgba(27, 31, 35, 0.05);
                      border-radius: 3px;
                      padding: 0.2em 0.4em;
                    }
                    .github-readme pre code {
                      background-color: transparent;
                      padding: 0;
                    }
                  `}</style>
              </>
            )}

            <RepositoryForm
              open={formVisible}
              onCancel={() => setFormVisible(false)}
              onSubmit={handleAddRepository}
              initialValues={{
                address: `https://github.com/${owner}/${name}`,
                type: 'git',
                branch: repoInfo?.default_branch || 'main',
                prompt: '',
              }}
              disabledFields={['address']}
            />
          </>
        )}
      </div>
    </div>
  );
}
