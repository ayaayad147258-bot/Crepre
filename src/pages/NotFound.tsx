import React from 'react';

export const NotFound: React.FC = () => {
    return (
        <div
            dir="rtl"
            style={{
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
                fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
        >
            <div
                style={{
                    background: 'white',
                    borderRadius: '24px',
                    padding: '48px 40px',
                    maxWidth: '420px',
                    width: '100%',
                    textAlign: 'center',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.08)',
                    border: '1px solid #f1f5f9',
                }}
            >
                <div style={{ fontSize: '80px', marginBottom: '16px' }}>🍽️</div>
                <h1
                    style={{
                        fontSize: '1.75rem',
                        fontWeight: '800',
                        color: '#1e293b',
                        margin: '0 0 12px',
                    }}
                >
                    المطعم غير موجود
                </h1>
                <p style={{ color: '#64748b', fontSize: '1rem', lineHeight: '1.6', margin: '0 0 32px' }}>
                    لم نتمكن من العثور على هذا المطعم.
                    <br />
                    تأكد من صحة الرابط أو تواصل مع صاحب المطعم.
                </p>
                <div
                    style={{
                        background: '#f8fafc',
                        borderRadius: '12px',
                        padding: '16px',
                        fontSize: '0.8rem',
                        color: '#94a3b8',
                        fontFamily: 'monospace',
                    }}
                >
                    {window.location.pathname}
                </div>
            </div>
        </div>
    );
};
