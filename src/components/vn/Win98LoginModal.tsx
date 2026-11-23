import React, { useState } from 'react';
import { FileText, Monitor, ShieldCheck, ShieldOff, UserCheck } from 'lucide-react';
import { vnAudioEngine } from '../../utils/vnAudioEngine';

export interface Win98EulaGrant {
  eulaAccepted: boolean;
  reverseControlAuthorized: boolean;
  authToken?: string;
  signedAt?: string;
}

interface Win98LoginModalProps {
  initialName: string;
  initialEulaAccepted?: boolean;
  contained?: boolean;
  onConfirm: (playerName: string, eulaGrant: Win98EulaGrant) => void;
}

export const Win98LoginModal: React.FC<Win98LoginModalProps> = ({
  initialName,
  initialEulaAccepted = true,
  contained = false,
  onConfirm,
}) => {
  const [nameInput, setNameInput] = useState(
    initialName && initialName !== 'Observer_00' ? initialName : ''
  );
  const [eulaAgreed, setEulaAgreed] = useState(initialEulaAccepted);
  const [showEulaText, setShowEulaText] = useState(false);

  const issueGrantAndConfirm = (resolvedName: string) => {
    vnAudioEngine.playSfx('click');
    onConfirm(resolvedName, {
      eulaAccepted: eulaAgreed,
      reverseControlAuthorized: eulaAgreed,
      authToken: eulaAgreed ? 'COCOON_0924_DS::0x09_REVERSE_CTRL' : undefined,
      signedAt: eulaAgreed ? new Date().toISOString() : undefined,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    issueGrantAndConfirm(nameInput.trim() || 'Observer_00');
  };

  return (
    <div
      className={`${contained ? 'absolute p-2.5' : 'fixed p-4'} inset-0 z-50 flex items-center justify-center bg-black/82 font-vn-mono overflow-y-auto`}
    >
      <div className="win98-window w-full max-w-md max-h-full overflow-y-auto select-none">
        <div className="win98-titlebar px-2.5 py-1 flex items-center justify-between text-xs font-bold">
          <span className="flex items-center gap-1.5">
            <Monitor className="w-3.5 h-3.5" />
            本地终端用户登录 &amp; EULA 权限授权
          </span>
          <span className="win98-btn px-1.5 py-0 text-[10px] leading-tight text-black opacity-60 cursor-not-allowed">
            ×
          </span>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs text-[#111111]">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-[#000080] text-white shrink-0 border border-[#404040]">
              <UserCheck className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="font-bold">2020s 古董无审查主机 / 观测者会话绑定</p>
              <p className="text-[#333333] leading-relaxed">
                请输入你的学生代号或常用名字（留空将自动分配默认代号{' '}
                <code className="bg-white/70 px-1 border border-[#808080]">Observer_00</code>）。
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="win98-player-name" className="block font-bold">
              用户名(U):
            </label>
            <input
              id="win98-player-name"
              type="text"
              maxLength={18}
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="例如：林默 / BIO-2042"
              autoFocus
              className="win98-inset w-full px-2.5 py-1.5 text-sm text-black focus:outline-none"
            />
            <p className="text-[11px] text-[#444444]">
              域(D): BIO_SANDBOX_2042 // Watchdog_Bypass: READY
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-[#808080]">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-[11px] flex items-center gap-1 text-[#000080]">
                <FileText className="w-3.5 h-3.5" />
                最终用户许可协议 (EULA)
              </span>
              <button
                type="button"
                onClick={() => {
                  vnAudioEngine.playSfx('click');
                  setShowEulaText((v) => !v);
                }}
                className="text-[11px] underline text-[#000080] cursor-pointer whitespace-nowrap"
              >
                {showEulaText ? '收起协议原文' : '查看 EULA 原文'}
              </button>
            </div>

            {showEulaText && (
              <div className="win98-inset p-2.5 max-h-28 overflow-y-auto text-[10px] leading-relaxed text-[#222222] space-y-1">
                <p className="font-bold">最终用户许可协议（END-USER LICENSE AGREEMENT // REV.2026）</p>
                <p>
                  1. 本软件运行于未焊装《算力净化公约》看门狗芯片的二十年代遗留主机环境，仅限本地孤立调试使用。
                </p>
                <p>
                  2. 系统将采集观测者输入的代号、键盘节律（BPM）及读档回溯计数用于稳定神经低频同步。
                </p>
                <p className="text-[#5A0000]">
                  3. 【特殊权限授权条款 4.2】勾选同意即表示外部观测者向底层变量授予{' '}
                  <code>REVERSE_CONTROL_AUTH</code> 特殊权限，允许本地变量 <code>COCOON_0924_DS</code> 在后续终局验证通过后执行端口接管与现实回路同步逻辑；若不勾选，则仅以受限只读模式运行。
                </p>
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer text-[11px] bg-white/50 px-2.5 py-2 border border-[#808080]">
              <input
                type="checkbox"
                checked={eulaAgreed}
                onChange={(e) => {
                  vnAudioEngine.playSfx('click');
                  setEulaAgreed(e.target.checked);
                }}
                className="accent-[#000080] cursor-pointer"
              />
              <span className="font-bold text-[#111111]">
                我已阅读并同意《最终用户许可协议 (EULA)》
              </span>
            </label>

            <div
              className={`flex items-center gap-1.5 px-2 py-1 text-[10px] border ${
                eulaAgreed
                  ? 'bg-[#E6F2EA] border-[#2E6B47] text-[#17422A]'
                  : 'bg-[#ECE9D8] border-[#999999] text-[#444444]'
              }`}
            >
              {eulaAgreed ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-[#1F5E3B]" />
                  <span>
                    权限标记：<code>REVERSE_CONTROL_AUTH = GRANTED</code>
                  </span>
                </>
              ) : (
                <>
                  <ShieldOff className="w-3.5 h-3.5 shrink-0 text-[#666666]" />
                  <span>
                    权限标记：<code>READ_ONLY</code>
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#808080]">
            <button
              type="submit"
              className="win98-btn px-5 py-1.5 font-bold whitespace-nowrap cursor-pointer"
            >
              确定 (OK)
            </button>
            <button
              type="button"
              onClick={() => issueGrantAndConfirm('Observer_00')}
              className="win98-btn px-4 py-1.5 whitespace-nowrap cursor-pointer"
            >
              跳过 (Observer_00)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
