import { Button, Form, Input, Modal, Select, message, Spin, Divider, Space, Switch, Typography, theme } from 'antd';
import { useState, useEffect } from 'react';
import { RepositoryFormValues } from '../types';
import { submitWarehouse } from '../services';
import { GithubOutlined, LockOutlined, UserOutlined, LinkOutlined, BranchesOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;
const { useToken } = theme;

interface RepositoryFormProps {
  open: boolean;
  onCancel: () => void;
  onSubmit: (values: RepositoryFormValues) => void;
  initialValues?: Partial<RepositoryFormValues>;
  disabledFields?: string[];
}

const RepositoryForm: React.FC<RepositoryFormProps> = ({
  open,
  onCancel,
  onSubmit,
  initialValues,
  disabledFields = [],
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [enableGitAuth, setEnableGitAuth] = useState(false);
  const { token } = useToken();

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // API呼び出し
      const response = await submitWarehouse(values) as any;

      if (response.data.code === 200) {
        message.success('リポジトリの追加に成功しました');
        onSubmit(values);
        form.resetFields();
      } else {
        message.error(response.data.message || '追加に失敗しました。もう一度お試しください');
      }
    } catch (error) {
      console.error('フォームの送信に失敗しました:', error);
    } finally {
      setLoading(false);
    }
  };

  // 重置表单
  useEffect(() => {
    if (!open) {
      setEnableGitAuth(false);
      form.resetFields();
    } else if (initialValues) {
      form.setFieldsValue(initialValues);
    }
  }, [open, form, initialValues]);

  const handleGitAuthChange = (checked: boolean) => {
    setEnableGitAuth(checked);
    if (!checked) {
      form.setFieldsValue({
        gitUserName: undefined,
        gitPassword: undefined
      });
    }
  };

  return (
    <Modal
      title={
        <Space>
          <GithubOutlined style={{ color: token.colorPrimary }} />
          <Title level={5} style={{ margin: 0 }}>リポジトリを追加</Title>
        </Space>
      }
      open={open}
      onCancel={onCancel}

      destroyOnClose
      footer={[
        <Button key="cancel" onClick={onCancel} disabled={loading}>
          キャンセル
        </Button>,
        <Button
          key="submit"
          type="primary"
          onClick={handleSubmit}
          loading={loading}
          icon={<GithubOutlined />}
        >
          送信
        </Button>,
      ]}
      width={500}
      bodyStyle={{
        padding: token.paddingLG,
        backgroundColor: token.colorBgContainer
      }}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark="optional"
        initialValues={{
          type: 'git',
          branch: 'main',
          enableGitAuth: false,
          ...initialValues,
        }}
        style={{ maxWidth: '100%' }}
      >
        <Form.Item
          name="address"
          label="リポジトリURL"
          rules={[{ required: true, message: 'リポジトリURLを入力してください' }]}
        >
          <Input
            placeholder="https://github.com/username/repository"
            prefix={<LinkOutlined style={{ color: token.colorTextSecondary }} />}
            allowClear
            disabled={disabledFields.includes('address')}
          />
        </Form.Item>
        {/*         
        <Form.Item
          name="branch"
          label="ブランチ名"
          rules={[{ required: true, message: 'ブランチ名を入力してください' }]}
        >
          <Input 
            placeholder="main" 
            prefix={<BranchesOutlined style={{ color: token.colorTextSecondary }} />}
            allowClear
          />
        </Form.Item> */}

        <Divider style={{ margin: `${token.marginMD}px 0` }} />

        <Form.Item
          name="enableGitAuth"
          label={
            <Space>
              <LockOutlined style={{ color: token.colorWarning }} />
              <Text>プライベートリポジトリ認証を有効にする</Text>
            </Space>
          }
          tooltip="プライベートリポジトリを使用する場合は、このオプションを有効にして認証情報を入力してください"
          valuePropName="checked"
        >
          <Switch onChange={handleGitAuthChange} />
        </Form.Item>

        {enableGitAuth && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Form.Item
              name="gitUserName"
              label="Gitユーザー名"
              rules={[{ required: enableGitAuth, message: 'Gitユーザー名を入力してください' }]}
            >
              <Input
                placeholder="Gitユーザー名を入力"
                prefix={<UserOutlined style={{ color: token.colorTextSecondary }} />}
                allowClear
              />
            </Form.Item>

            <Form.Item
              name="gitPassword"
              label="Gitパスワード / アクセストークン"
              rules={[{ required: enableGitAuth, message: 'Gitパスワードまたはトークンを入力してください' }]}
              extra={<Text type="secondary" style={{ fontSize: token.fontSizeSM }}>GitHubの場合、Personal Access Tokenの使用を推奨します</Text>}
            >
              <Input.Password
                placeholder="Gitパスワードまたはトークンを入力"
                prefix={<LockOutlined style={{ color: token.colorTextSecondary }} />}
              />
            </Form.Item>
          </Space>
        )}
      </Form>
    </Modal>
  );
};

export default RepositoryForm; 