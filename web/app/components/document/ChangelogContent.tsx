import React from 'react';
import { Timeline, Typography, Card, Tag, Flex, theme, Alert } from 'antd';
import {
  CalendarOutlined,
  UserOutlined,
  ClockCircleOutlined,
  GithubOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { useToken } = theme;

interface ChangelogItem {
  version: string;
  date: string;
  author: string;
  description: string;
  commitHash?: string;
  type: 'feature' | 'fix' | 'docs' | 'refactor' | 'chore' | 'style' | 'perf' | 'test' | 'build' | 'ci' | 'revert';
}

interface ChangelogContentProps {
  items: ChangelogItem[];
  repoUrl?: string;
}

// タグカラーを取得
const getTagColor = (type: string) => {
  const colorMap: Record<string, string> = {
    feature: 'success',
    fix: 'error',
    docs: 'processing',
    refactor: 'warning',
    chore: 'default',
    style: 'purple',
    perf: 'volcano',
    test: 'geekblue',
    build: 'gold',
    ci: 'lime',
    revert: 'magenta'
  };

  return colorMap[type] || 'default';
};

const ChangelogContent: React.FC<ChangelogContentProps> = ({ items, repoUrl }) => {
  const { token } = useToken();

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Title level={2} style={{ marginBottom: token.marginLG, color: token.colorTextHeading }}>
        更新ログ
      </Title>

      {repoUrl && (
        <Alert
          message={
            <Flex align="center" gap={token.marginXS}>
              <GithubOutlined />
              <Text>GitHubで完全なコミット履歴を確認できます：</Text>
              <a href={repoUrl} target="_blank" rel="noopener noreferrer">
                {repoUrl.replace(/^https?:\/\/(www\.)?github\.com\//, '')}
              </a>
            </Flex>
          }
          type="info"
          showIcon={false}
          style={{ marginBottom: token.marginLG }}
        />
      )}

      <Timeline
        mode="left"
        items={items.map((item, index) => ({
          label: (
            <Flex vertical gap={token.marginXS}>
              <Text style={{ color: token.colorTextSecondary }}>
                <CalendarOutlined style={{ marginRight: token.marginXS }} />
                {item.date}
              </Text>
              {item.author && (
                <Text style={{ color: token.colorTextSecondary }}>
                  <UserOutlined style={{ marginRight: token.marginXS }} />
                  {item.author}
                </Text>
              )}
            </Flex>
          ),
          children: (
            <Card
              bordered={false}
              style={{
                marginBottom: token.marginMD,
                boxShadow: token.boxShadowTertiary,
                borderRadius: token.borderRadiusLG
              }}
            >
              <Flex align="center" gap={token.marginSM} style={{ marginBottom: token.marginSM }}>
                <Title
                  level={4}
                  style={{
                    margin: 0,
                    color: token.colorPrimary
                  }}
                >
                  {item.version}
                </Title>
                <Tag
                  color={getTagColor(item.type)}
                  style={{
                    marginLeft: 'auto',
                    borderRadius: token.borderRadiusLG,
                    fontSize: token.fontSizeSM
                  }}
                >
                  {item.type}
                </Tag>
              </Flex>

              <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {item.description}
              </Paragraph>

              {item.commitHash && (
                <Text type="secondary" style={{ fontSize: token.fontSizeSM, marginTop: token.marginSM, display: 'block' }}>
                  <ClockCircleOutlined style={{ marginRight: token.marginXS }} />
                  コミット: {item.commitHash.substring(0, 7)}
                </Text>
              )}
            </Card>
          ),
          color: index === 0 ? token.colorPrimary : undefined,
        }))}
      />
    </div>
  );
};

export default ChangelogContent;
