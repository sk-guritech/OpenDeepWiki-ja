import { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Button,
  message,
  Spin,
  Typography,
  Descriptions,
  Tag,
  Space,
  Result,
  Row,
  Col,
  theme,
  Divider,
  Card
} from 'antd';
import {
  SearchOutlined,
  GithubOutlined,
  BranchesOutlined,
  ClockCircleOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  StopOutlined,
  LockOutlined,
  QuestionCircleOutlined,
  LinkOutlined
} from '@ant-design/icons';
import { getLastWarehouse } from '../services/warehouseService';
import { Repository } from '../types';
import { homepage } from '../const/urlconst';

const { Text, Title } = Typography;
const { useToken } = theme;

interface LastRepoModalProps {
  open: boolean;
  onCancel: () => void;
}

const LastRepoModal: React.FC<LastRepoModalProps> = ({ open, onCancel }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [repository, setRepository] = useState<Repository | null>(null);
  const [searched, setSearched] = useState(false);
  const { token } = useToken();

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setRepository(null);
      setSearched(false);
    }
  }, [open, form]);

  const handleSearch = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      setSearched(false);

      try {
        const response = await getLastWarehouse(values.address);
        if (response.success && response.data) {
          setRepository(response.data);
          setSearched(true);
        } else {
          message.error('検索に失敗しました: ' + (response.error || '該当するリポジトリが見つかりませんでした'));
          setRepository(null);
        }
      } catch (error) {
        console.error('リポジトリ検索エラー:', error);
        message.error('リポジトリの検索中にエラーが発生しました。後でもう一度お試しください。');
        setRepository(null);
      } finally {
        setLoading(false);
      }
    } catch (error) {
      // 表单验证失败
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setRepository(null);
    setSearched(false);
    onCancel();
  };

  // 获取仓库状态文本
  const getStatusText = (status: number) => {
    const statusMap: Record<number, { text: string; color: string; icon: React.ReactNode }> = {
      0: { text: '保留中', color: 'warning', icon: <ClockCircleOutlined /> },
      1: { text: '処理中', color: 'processing', icon: <SyncOutlined spin /> },
      2: { text: '完了', color: 'success', icon: <CheckCircleOutlined /> },
      3: { text: 'キャンセル済み', color: 'default', icon: <StopOutlined /> },
      4: { text: '未認可', color: 'purple', icon: <LockOutlined /> },
      99: { text: '失敗', color: 'error', icon: <ExclamationCircleOutlined /> },
    };
    return statusMap[status] || { text: '不明な状態', color: 'default', icon: <QuestionCircleOutlined /> };
  };

  // 渲染内容区域
  const renderContent = () => {
    if (loading) {
      return (
        <div style={{ padding: token.paddingLG, textAlign: 'center' }}>
          <Spin size="large" />
          <Text type="secondary" style={{ display: 'block', marginTop: token.marginMD, fontSize: token.fontSizeLG }}>
            リポジトリ情報を検索中...
          </Text>
        </div>
      );
    }

    if (searched && !repository) {
      return (
        <Result
          status="warning"
          title={<span style={{ fontSize: token.fontSizeLG }}>リポジトリが見つかりません</span>}
          subTitle={<span style={{ fontSize: token.fontSize }}>入力したURLが正しいか確認してください</span>}
          icon={<ExclamationCircleOutlined style={{ color: token.colorWarning, fontSize: 64 }} />}
          style={{ padding: token.paddingLG }}
        />
      );
    }

    if (searched && repository) {
      const statusInfo = getStatusText(repository.status);

      return (
        <Card
          bordered={false}
          style={{
            marginTop: token.marginLG,
            boxShadow: token.boxShadowTertiary,
            borderRadius: token.borderRadiusLG
          }}
          bodyStyle={{ padding: 0 }}
        >
          <div style={{
            padding: `${token.paddingMD}px ${token.paddingLG}px`,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Title level={5} style={{ margin: 0, color: token.colorTextHeading }}>検索結果</Title>
            <Tag
              color={statusInfo.color}
              icon={statusInfo.icon}
              style={{
                padding: `${token.paddingXS}px ${token.paddingSM}px`,
                fontSize: token.fontSize
              }}
            >
              {statusInfo.text}
            </Tag>
          </div>

          <Descriptions
            bordered
            size="middle"
            column={1}
            labelStyle={{
              backgroundColor: token.colorBgLayout,
              padding: `${token.paddingSM}px ${token.paddingMD}px`,
              width: '25%',
              fontSize: token.fontSize
            }}
            contentStyle={{
              padding: `${token.paddingSM}px ${token.paddingMD}px`,
              fontSize: token.fontSize
            }}
          >
            <Descriptions.Item label="リポジトリ名">
              <Text strong>{repository.name}</Text>
            </Descriptions.Item>

            <Descriptions.Item label="リポジトリURL">
              <Text
                ellipsis={{
                  tooltip: repository.address
                }}
                style={{ maxWidth: '100%', display: 'inline-block' }}
                copyable
              >
                {repository.address}
              </Text>
            </Descriptions.Item>

            <Descriptions.Item label="リポジトリ情報">
              <Space size={token.marginSM}>
                <Tag
                  icon={<GithubOutlined />}
                  color="blue"
                  style={{ padding: `2px ${token.paddingSM}px`, fontSize: token.fontSize }}
                >
                  {repository.type}
                </Tag>
                <Tag
                  icon={<BranchesOutlined />}
                  color="cyan"
                  style={{ padding: `2px ${token.paddingSM}px`, fontSize: token.fontSize }}
                >
                  {repository.branch}
                </Tag>
              </Space>
            </Descriptions.Item>

            {repository.error && (
              <Descriptions.Item
                label={<Text type="danger" strong>エラーメッセージ</Text>}
                contentStyle={{ backgroundColor: token.colorErrorBg }}
              >
                <Text type="danger" style={{ fontSize: token.fontSize }}>{repository.error}</Text>
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>
      );
    }

    return null;
  };

  return (
    <Modal
      title={<Title level={4} style={{ margin: 0 }}>リポジトリ検索</Title>}
      open={open}
      onCancel={handleCancel}
      footer={null}
      width={{ xs: '95%', sm: 600, md: 700 }}
      centered
      destroyOnClose
      bodyStyle={{ padding: token.paddingLG }}
      style={{ top: 20 }}
    >
      <Form
        form={form}
        layout="vertical"
        size="large"
        style={{ marginBottom: token.marginMD }}
      >
        <Form.Item
          name="address"
          label={<Text strong style={{ fontSize: token.fontSizeLG }}>リポジトリURL</Text>}
          rules={[{ required: true, message: 'リポジトリURLを入力してください' }]}
          tooltip={{ title: 'Gitリポジトリの完全なURLを入力してください', icon: <InfoCircleOutlined /> }}
          style={{ marginBottom: token.marginSM }}
        >
          <Input
            placeholder="GitリポジトリのURLを入力"
            prefix={
              <LinkOutlined
                style={{
                  color: token.colorTextSecondary,
                  fontSize: token.fontSizeLG,
                  marginRight: token.marginXS
                }}
              />
            }
            suffix={
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={handleSearch}
                loading={loading}
                style={{
                  marginRight: -7,
                  height: 40,
                  fontSize: token.fontSize,
                  paddingInline: token.paddingMD
                }}
              >
                検索
              </Button>
            }
            onPressEnter={handleSearch}
            autoFocus
            allowClear
            size="large"
            style={{ height: 48, fontSize: token.fontSize }}
          />
        </Form.Item>
        <Text type="secondary" style={{ fontSize: token.fontSize, marginLeft: token.marginSM }}>
          例: {homepage}
        </Text>
      </Form>

      {renderContent()}
    </Modal>
  );
};

export default LastRepoModal;