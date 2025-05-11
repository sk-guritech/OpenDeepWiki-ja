'use client';

import React, { useState, useRef } from 'react';
import { Input, Button, Switch, Flex, Space, theme, Grid, Tooltip } from 'antd';
import type { InputRef } from 'antd';
import { SendOutlined, LoadingOutlined, UpOutlined } from '@ant-design/icons';
import { createChatShareMessage } from '../services/chatShareMessageServce';

const { useBreakpoint } = Grid;

interface AIInputBarProps {
    owner: string;
    name: string;
    style?: React.CSSProperties;
}

// OpenAI Logo SVG组件
const OpenAILogo: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
    <svg
        fill="currentColor" height="34" viewBox="0 0 24 24" width="64"
        xmlns="http://www.w3.org/2000/svg"
        style={{
            display: 'flex',
            lineHeight: '1',
        }}>
        <title>OpenAI</title>
        <path d="M21.55 10.004a5.416 5.416 0 00-.478-4.501c-1.217-2.09-3.662-3.166-6.05-2.66A5.59 5.59 0 0010.831 1C8.39.995 6.224 2.546 5.473 4.838A5.553 5.553 0 001.76 7.496a5.487 5.487 0 00.691 6.5 5.416 5.416 0 00.477 4.502c1.217 2.09 3.662 3.165 6.05 2.66A5.586 5.586 0 0013.168 23c2.443.006 4.61-1.546 5.361-3.84a5.553 5.553 0 003.715-2.66 5.488 5.488 0 00-.693-6.497v.001zm-8.381 11.558a4.199 4.199 0 01-2.675-.954c.034-.018.093-.05.132-.074l4.44-2.53a.71.71 0 00.364-.623v-6.176l1.877 1.069c.02.01.033.029.036.05v5.115c-.003 2.274-1.87 4.118-4.174 4.123zM4.192 17.78a4.059 4.059 0 01-.498-2.763c.032.02.09.055.131.078l4.44 2.53c.225.13.504.13.73 0l5.42-3.088v2.138a.068.068 0 01-.027.057L9.9 19.288c-1.999 1.136-4.552.46-5.707-1.51h-.001zM3.023 8.216A4.15 4.15 0 015.198 6.41l-.002.151v5.06a.711.711 0 00.364.624l5.42 3.087-1.876 1.07a.067.067 0 01-.063.005l-4.489-2.559c-1.995-1.14-2.679-3.658-1.53-5.63h.001zm15.417 3.54l-5.42-3.088L14.896 7.6a.067.067 0 01.063-.006l4.489 2.557c1.998 1.14 2.683 3.662 1.529 5.633a4.163 4.163 0 01-2.174 1.807V12.38a.71.71 0 00-.363-.623zm1.867-2.773a6.04 6.04 0 00-.132-.078l-4.44-2.53a.731.731 0 00-.729 0l-5.42 3.088V7.325a.068.068 0 01.027-.057L14.1 4.713c2-1.137 4.555-.46 5.707 1.513.487.833.664 1.809.499 2.757h.001zm-11.741 3.81l-1.877-1.068a.065.065 0 01-.036-.051V6.559c.001-2.277 1.873-4.122 4.181-4.12.976 0 1.92.338 2.671.954-.034.018-.092.05-.131.073l-4.44 2.53a.71.71 0 00-.365.623l-.003 6.173v.002zm1.02-2.168L12 9.25l2.414 1.375v2.75L12 14.75l-2.415-1.375v-2.75z"></path></svg>
);

const AIInputBar: React.FC<AIInputBarProps> = ({ owner, name, style }) => {
    const { token } = theme.useToken();
    const screens = useBreakpoint();
    const [isLoading, setIsLoading] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [deepResearch, setDeepResearch] = useState(false);
    const [collapsed, setCollapsed] = useState(true);
    const inputRef = useRef<InputRef>(null);

    const handleSend = async () => {
        if (inputValue.trim() && !isLoading) {
            setIsLoading(true);

            const warehouseId = await createChatShareMessage({
                isDeep: deepResearch,
                owner: owner,
                name: name,
                message: inputValue,
            })

            window.open(`/search/${warehouseId.data.data}`)

            setInputValue('');
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const toggleCollapse = () => {
        setCollapsed(!collapsed);
    };

    // 深入推理开关的标签
    const researchLabel = screens.sm ? '深く推論' : '';

    // 悬浮球样式
    const floatingBallStyle = {
        width: '45px',
        height: '45px',
        borderRadius: '50%',
        bottom: 24,
        backgroundColor: token.colorPrimary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: `0px 2px 8px rgba(0, 0, 0, 0.15)`,
        cursor: 'pointer',
        color: token.colorTextLightSolid,
        transition: `all ${token.motionDurationMid}`,
        position: 'absolute' as const,
        right: '0',
        transform: collapsed ? 'translateX(70%)' : 'translateX(0)',
    };

    // 展开状态的容器样式
    const expandedContainerStyle = {
        padding: token.paddingSM,
        backgroundColor: token.colorBgContainer,
        position: 'absolute' as const,
        borderRadius: '10px',
        boxShadow: `rgb(189 188 188) 0px -2px 8px`,
        transition: `all ${token.motionDurationMid}`,
        ...style
    };

    return (
        <div style={{
            position: 'fixed',
            right: '20px',
            bottom: '80px',
            zIndex: 1000,
            ...style
        }}>
            {collapsed ? (
                <Tooltip title="AIアシスタントを開く" placement="left">
                    <div
                        style={floatingBallStyle}
                        onClick={toggleCollapse}
                    >
                        <OpenAILogo style={{ color: 'white' }} />
                    </div>
                </Tooltip>
            ) : (
                <div style={expandedContainerStyle}>
                    <Flex
                        align="center"
                        justify="space-between"
                        style={{ marginBottom: token.marginXS }}
                    >
                        <span style={{ fontSize: token.fontSizeSM, fontWeight: 'bold' }}></span>
                        <Button
                            type="text"
                            icon={<UpOutlined />}
                            size="small"
                            onClick={toggleCollapse}
                            title="折りたたむ"
                        />
                    </Flex>
                    <Flex
                        align="center"
                        justify="center"
                        style={{
                            margin: '0 auto',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Input.TextArea
                            ref={inputRef}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="質問を入力..."
                            autoSize={{ minRows: 1, maxRows: 4 }}
                            disabled={isLoading}
                            style={{
                                marginBottom: '10px',
                                resize: 'none',
                                outline: 'none',
                                border: 'none',
                                boxShadow: 'none',
                                width: '100%'
                            }}
                        />

                        <Space
                            style={{
                                width: '100%',
                                display: 'flex',
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                            }}
                        >
                            <Flex>
                                <Switch
                                    size="small"
                                    checked={deepResearch}
                                    onChange={setDeepResearch}
                                    disabled={isLoading}
                                    style={{ marginRight: researchLabel ? token.marginXS : 0 }}
                                />
                                {researchLabel && (
                                    <span style={{ fontSize: token.fontSizeSM, whiteSpace: 'nowrap' }}>
                                        {researchLabel}
                                    </span>
                                )}
                            </Flex>

                            <Button
                                type="primary"
                                icon={isLoading ? <LoadingOutlined /> : <SendOutlined />}
                                onClick={handleSend}
                                shape="circle"
                                size="large"
                                disabled={isLoading || !inputValue.trim()}
                                style={{
                                    transition: `all ${token.motionDurationMid}`,
                                }}
                            />
                        </Space>
                    </Flex>
                </div>
            )}
        </div>
    );
};

export default AIInputBar; 