// デモ版のエントリポイント（npm run build:mock で mock/dist/gooner5-demo.html を生成）
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { Dashboard } from "../src/components/dashboard/dashboard";
import { DEMO_TODAY, installMockApi, resetDemo } from "./mock-api";

installMockApi();

function DemoApp() {
  const [key, setKey] = useState(0);
  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-warn/40 bg-warn/15 px-4 py-1.5 text-center text-xs text-warn-ink">
        <span>
          <b>デモ版</b>：サンプルデータで動作しています（今日＝{DEMO_TODAY.replace(/-/g, "/")} として計算）。操作内容はこのブラウザにだけ保存されます。
        </span>
        <button
          type="button"
          className="rounded-md border border-warn/50 px-2 py-0.5 font-bold hover:bg-warn/20"
          onClick={() => {
            resetDemo();
            setKey((k) => k + 1);
          }}
        >
          最初の状態に戻す
        </button>
      </div>
      <Dashboard key={key} />
    </>
  );
}

createRoot(document.getElementById("root")!).render(<DemoApp />);
