import Link from 'next/link';

interface ServerLoadingErrorStateProps {
  loading: boolean;
  error?: string | null;
  owner: string;
  name: string;
}

// サーバーコンポーネント用の簡易ロードエラー状態コンポーネント
export function ServerLoadingErrorState({
  loading,
  error,
  owner,
  name
}: ServerLoadingErrorStateProps) {
  // 読み込み中の状態
  if (loading) {
    return (
      <div style={{
        padding: '24px',
        background: '#fff',
        borderRadius: '8px',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
        minHeight: '300px'
      }}>
        <div style={{ height: '24px', background: '#f5f5f5', borderRadius: '4px', width: '40%', marginBottom: '16px' }}></div>
        <div style={{ height: '16px', background: '#f5f5f5', borderRadius: '4px', width: '90%', marginBottom: '8px' }}></div>
        <div style={{ height: '16px', background: '#f5f5f5', borderRadius: '4px', width: '80%', marginBottom: '8px' }}></div>
        <div style={{ height: '16px', background: '#f5f5f5', borderRadius: '4px', width: '85%', marginBottom: '8px' }}></div>
        <div style={{ height: '16px', background: '#f5f5f5', borderRadius: '4px', width: '75%', marginBottom: '24px' }}></div>
      </div>
    );
  }

  // エラー状態
  if (error) {
    return (
      <div style={{
        padding: '32px 24px',
        textAlign: 'center',
        background: '#fff',
        borderRadius: '8px',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
        minHeight: '300px'
      }}>
        <div style={{ fontSize: '24px', marginBottom: '16px', color: '#000000d9' }}>
          {error.includes('不存在') ? 'リクエストされたドキュメントが見つかりませんでした' : '読み込みに失敗しました'}
        </div>
        <div style={{ fontSize: '14px', color: '#00000073', marginBottom: '24px' }}>
          {error}
        </div>
        <div>
          <Link href={`/${owner}/${name}`} style={{
            display: 'inline-block',
            padding: '8px 16px',
            background: '#1890ff',
            color: '#fff',
            borderRadius: '4px',
            textDecoration: 'none',
            marginRight: '8px'
          }}>
            リポジトリ概要に戻る
          </Link>
          {error.includes('不存在') && (
            <Link href="/" style={{
              display: 'inline-block',
              padding: '8px 16px',
              background: '#ffffff',
              border: '1px solid #d9d9d9',
              color: '#000000d9',
              borderRadius: '4px',
              textDecoration: 'none'
            }}>
              ホームに戻る
            </Link>
          )}
        </div>
      </div>
    );
  }

  return null;
}
