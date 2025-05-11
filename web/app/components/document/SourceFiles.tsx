import React, { useState } from 'react';
import { Collapse, List, Typography, Space } from 'antd';
import { FileOutlined, CaretRightOutlined, GithubFilled } from '@ant-design/icons';
import Link from 'next/link';

const { Text } = Typography;

interface SourceFile {
  documentFileItemId: string;
  address: string;
  name: string;
  documentFileItem: any;
  id: string;
  createdAt: string;
}

interface SourceFilesProps {
  fileSource: SourceFile[];
  owner: string;
  name: string;
  token: any;
  git: string;
  branch?: string;
}

const SourceFiles: React.FC<SourceFilesProps> = ({
  fileSource,
  owner,
  name,
  token,
  git,
  branch,
}) => {
  const [activeKey, setActiveKey] = useState<string | string[]>([]);

  return (
    <Collapse
      ghost
      expandIcon={({ isActive }) => (
        <CaretRightOutlined
          rotate={isActive ? 90 : 0}
          style={{ color: token.colorTextTertiary }}
        />
      )}
      activeKey={activeKey}
      onChange={(key) => setActiveKey(key)}
      style={{
        marginBottom: token.marginMD,
        backgroundColor: 'transparent',
        borderRadius: token.borderRadius,
        border: `1px solid ${token.colorBorderSecondary}`
      }}
    >
      <Collapse.Panel
        header={
          <Text strong style={{ color: token.colorText }}>関連ソースファイル</Text>
        }
        key="sourceFiles"
        style={{ padding: token.paddingXS }}
      >
        <List
          size="small"
          dataSource={fileSource}
          split={false}
          renderItem={(item) => (
            <List.Item style={{ padding: `${token.paddingXXS}px 0` }}>
              <Link
                href={`${git}/blob/${branch}/${item.address}`}
                target="_blank"
                style={{
                  color: token.colorPrimary,
                  display: 'flex',
                  alignItems: 'center',
                  // hover時のスタイル
                  // @ts-ignore
                  '&:hover': {
                    textDecoration: 'underline',
                    opacity: 0.85,
                  },
                }}
              >
                <GithubFilled style={{ fontSize: '14px', marginRight: token.marginXS }} />
                <Text style={{ fontSize: token.fontSizeSM }}>{item.name}</Text>
              </Link>
            </List.Item>
          )}
        />
      </Collapse.Panel>
    </Collapse>
  );
};

export default SourceFiles;
