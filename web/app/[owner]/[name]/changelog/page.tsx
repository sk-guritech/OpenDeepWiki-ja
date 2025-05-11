'use client'

import { useEffect, useState, use } from 'react';
import { getChangeLog } from '../../../services/warehouseService';
import { Empty, theme, Typography } from 'antd';
import { ServerLoadingErrorState } from '../../../components/document/ServerComponents';
import { ApiResponse } from '../../../services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const { useToken } = theme;
const { Title } = Typography;

interface PageParams {
  owner: string;
  name: string;
}

export default function ChangelogPage({ params }: { params: Promise<PageParams> }) {
  const { token } = useToken();
  const unwrappedParams = use(params);
  const { owner, name } = unwrappedParams;
  const [changelog, setChangelog] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchChangelog() {
      try {
        setLoading(true);
        const response = await getChangeLog(owner, name);
        console.log(response);

        setChangelog(response.data);
        setLoading(false);
      } catch (err) {
        // 更新ログの取得に失敗しました
        console.error('更新ログの取得に失敗しました', err);
        setError('更新ログの取得に失敗しました');
        setLoading(false);
      }
    }

    if (owner && name) {
      fetchChangelog();
    }
  }, [owner, name]);

  if (loading) {
    return <ServerLoadingErrorState loading={true} owner={owner} name={name} />;
  }

  if (error) {
    return <ServerLoadingErrorState loading={false} error={error} owner={owner} name={name} />;
  }

  if (!changelog) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="更新ログがありません"
        style={{
          marginTop: token.marginXL,
          padding: token.paddingLG
        }}
      />
    );
  }

  return (
    <div style={{
      maxWidth: 800,
      margin: '0 auto',
      padding: token.paddingLG,
      backgroundColor: token.colorBgContainer,
      borderRadius: token.borderRadiusLG,
      boxShadow: token.boxShadowTertiary
    }}>
      <Title level={2} style={{ marginBottom: token.marginLG, color: token.colorTextHeading }}>
        更新ログ
      </Title>

      <div className="markdown-content" style={{
        color: token.colorText,
        lineHeight: 1.6,
        fontSize: token.fontSize
      }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {changelog.commitMessage}
        </ReactMarkdown>
      </div>
    </div>
  );
}
