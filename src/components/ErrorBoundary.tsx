import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('UI ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-screen w-full bg-[#0E1218] text-[#F5F3EE] flex items-center justify-center p-6"
        >
          <div className="w-full max-w-[420px] rounded-2xl bg-[#161C26] border border-white/12 p-6 text-center space-y-4 shadow-[0_24px_64px_rgba(0,0,0,0.65)]">
            <h1 className="text-xl font-extrabold text-[#F5F3EE]">
              کێشەیەکی کاتی ڕوویدا
            </h1>
            <p className="text-sm text-[#A1AAB8] leading-relaxed">
              تکایە پەڕەکە نوێ بکەرەوە بۆ ئەوەی بەردەوام بیت لە یاریکردن. هەموو داتاکانت پارێزراون.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-3 rounded-xl bg-[#E5A93C] hover:bg-[#F2BE5C] text-[#10141B] font-extrabold text-sm transition-colors cursor-pointer"
            >
              نوێکردنەوەی پەڕە
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
