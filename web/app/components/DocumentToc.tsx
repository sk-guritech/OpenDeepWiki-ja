import { Anchor, Card, Divider, Typography } from 'antd';
import { AnchorLinkItemProps } from 'antd/es/anchor/Anchor';
import { UnorderedListOutlined } from '@ant-design/icons';

const { Title } = Typography;

interface DocumentTocProps {
  toc: AnchorLinkItemProps[];
}

const DocumentToc: React.FC<DocumentTocProps> = ({ toc }) => {
  if (!toc || toc.length === 0) {
    return null;
  }

  return (
    <Card
      className="toc-card"
      title={
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <UnorderedListOutlined style={{ marginRight: 8, color: 'var(--ant-color-primary)' }} />
          <Title level={5} style={{ margin: 0 }}>ドキュメントディレクトリ</Title>
        </div>
      }
    >
      <Divider style={{ margin: '0 0 12px 0' }} />
      <Anchor
        items={toc}
        affix={false}
        showInkInFixed
        targetOffset={80}
        style={{ fontSize: '14px' }}
      />
    </Card>
  );
};

export default DocumentToc; 