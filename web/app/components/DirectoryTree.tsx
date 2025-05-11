import { Card, Tree, Typography, Divider } from 'antd';
import { DataNode } from 'antd/es/tree';
import { useRouter } from 'next/navigation';
import { FolderOutlined, FileOutlined } from '@ant-design/icons';

const { Title } = Typography;
const { DirectoryTree } = Tree;

interface DirectoryTreeProps {
  treeData: DataNode[];
  repositoryId?: string;
  owner?: string;
  name?: string;
  currentPath?: string;
}

const DocDirectoryTree: React.FC<DirectoryTreeProps> = ({
  treeData,
  repositoryId,
  owner,
  name,
  currentPath
}) => {
  const router = useRouter();

  const handleSelect = (_, info) => {
    const selectedNode = info.node;
    if (!selectedNode.children) {
      const path = selectedNode.key;

      // 根据提供的参数决定使用哪种路由格式
      if (owner && name) {
        router.push(`/${owner}/${name}/doc/${path}`);
      } else if (repositoryId) {
        router.push(`/repository/${repositoryId}/doc/${path}`);
      }
    }
  };

  // 递归处理树节点，添加图标
  const processTreeData = (data: DataNode[]): DataNode[] => {
    return data.map(node => {
      const newNode = { ...node };

      if (newNode.children) {
        newNode.icon = <FolderOutlined />;
        newNode.children = processTreeData(newNode.children);
      } else {
        newNode.icon = <FileOutlined />;
      }

      return newNode;
    });
  };

  const processedTreeData = processTreeData(treeData);

  return (
    <Card
      className="directory-tree-card"
      title={
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <FolderOutlined style={{ marginRight: 8, color: 'var(--ant-color-primary)' }} />
          <Title level={5} style={{ margin: 0 }}>ドキュメントディレクトリ</Title>
        </div>
      }
    >
      <Divider style={{ margin: '0 0 12px 0' }} />
      <DirectoryTree
        defaultExpandAll
        onSelect={handleSelect}
        treeData={processedTreeData}
        selectedKeys={currentPath ? [currentPath] : []}
        blockNode
        showIcon
      />
    </Card>
  );
};

export default DocDirectoryTree; 