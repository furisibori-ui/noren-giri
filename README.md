# THE NOREN GIRI（のれん切り）

ブラウザで遊べるのれん切りアクションゲーム。  
HTML5 Canvas + Vanilla JS。PC・スマホ対応。

## 遊び方

- **赤のれん** … スワイプで切る → スコアアップ・コンボ継続・必殺ゲージ増加
- **黒のれん** … 切らない（切るとコンボリセット）
- 赤を見逃すと累積赤字が増え、3回でゲームオーバー
- **必殺ゲージ** … 赤を切る／ピンチで溜まる。満タンで「鬼十速斬」発動（画面中の幕を一掃）

## ローカルで動かす

1. このフォルダをそのまま開く  
   - または `npx serve .` で簡易サーバーを立てて `http://localhost:3000` で開く

2. 素材を入れる  
   - 画像 → `assets/images/`（logo.png, background.png, bill1.png, bill2.png）  
   - 音 → `assets/sounds/`（bgm.mp3, slash_soft.mp3, slash_good.mp3 など）  
   - 詳細は **素材の入れ方.txt** を参照

## GitHub + Vercel で公開する

### 1. このフォルダだけをGitHubに上げる場合

1. **noren-giri** フォルダで新しいリポジトリを作る  
   ```bash
   cd noren-giri
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/あなたのユーザー名/リポジトリ名.git
   git push -u origin main
   ```

2. **Vercel** で  
   - [vercel.com](https://vercel.com) にログイン  
   - 「Add New」→「Project」でそのリポジトリをインポート  
   - Root Directory は **指定しない**（このフォルダがルート）  
   - Deploy すると `https://〇〇.vercel.app` で公開される  

### 2. plan02 全体のリポジトリで、このゲームだけVercelに出す場合

1. plan02 をGitHubにプッシュする（noren-giri フォルダも含める）

2. Vercel で  
   - そのリポジトリをインポート  
   - **Root Directory** に `noren-giri` を指定  
   - Deploy すると noren-giri の中身がサイトのルートとして公開される  

### ランキングについて

- ランキングは **同じ端末だけ**（ブラウザの localStorage）に保存されます。上位20位まで。名前（5文字）＋スコアで記録します。

### 補足

- 静的サイト（HTML/CSS/JS）なので、Vercel は自動で index.html を配信します。  
- 画像・音声は **assets/images/** と **assets/sounds/** に分けたままがおすすめです（同じ「assets」の下で種類別に分けているだけです）。
