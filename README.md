# 🤖 Zyfora - Advanced Telegram Bot for Google Drive

<p align="center">
  <img src="https://img.shields.io/badge/Cloudflare-Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Cloudflare Workers">
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Telegram-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram">
</p>

A powerful, feature-rich Telegram bot for Google Drive management, built with TypeScript and running on Cloudflare Workers. Zero server costs, lightning-fast responses.

---

## ✨ Features

### 🔍 Search & Clone
- **Smart Search** - Search files across all connected Google Drives with regex support
- **One-Click Clone** - Clone files to your destination folder instantly
- **Batch Copy** - Copy multiple files at once with a single command
- **Paginated Results** - Navigate through large search results with inline buttons
- **Search Caching** - Faster repeated searches with intelligent caching

### 📁 File Management
- **List Files** - View contents of your destination folder with pagination
- **Create Folders** - Create new folders in Google Drive
- **Rename Files** - Rename files directly from Telegram
- **Delete Files** - Remove files (Admin only)
- **File Info** - Get detailed metadata about any file
- **Share Files** - Generate shareable links with permission control

### 📊 MediaInfo Analysis
- **Visual MediaInfo** - Beautiful image-based media analysis report
- **Codec Detection** - Video/Audio codec, resolution, bitrate details
- **Track Listing** - Audio tracks with language flags, subtitle information
- **Pastebin Reports** - Full detailed reports uploaded to pastebin
- **Direct URL Support** - Analyze files from any HTTP/HTTPS URL, not just Google Drive

### ⭐ Favorites & History
- **Add Favorites** - Save files for quick access later
- **View Favorites** - List all your saved favorites
- **Remove Favorites** - Manage your favorites list
- **Recent Activity** - View your recent searches and copies

### 🛠️ Utilities
- **QR Code Generator** - Generate QR codes for any text or URL
- **URL Shortener** - Create short URLs using TinyURL
- **Hash Generator** - Generate MD5 and SHA-256 hashes
- **Ping** - Check bot status and response time
- **Quota Check** - View your daily usage limits

### 👑 Admin Features
- **User Statistics** - View bot usage statistics
- **Ban/Unban Users** - Moderate bot access
- **Authorize Users** - Grant DM access to specific users
- **Broadcast** - Send messages to all users
- **Rate Limiting** - Prevent abuse with configurable limits
- **Structured Logging** - JSON-formatted logs for monitoring

### 🔒 Security
- **Webhook Verification** - Secure webhook with secret token
- **User Authorization** - Restrict bot to specific chats or authorized users
- **Admin Roles** - Separate permissions for admins
- **Secrets Management** - Credentials stored as Cloudflare secrets

---

## 📋 Commands

### General Commands
| Command | Description |
|---------|-------------|
| `/start` | Welcome message and bot info |
| `/help` | Show help menu with all commands |
| `/search [query]` | Search files in Google Drive |
| `/copy [url/id]` | Clone a file to destination folder |
| `/info [url/id]` | Get file metadata and details |
| `/list` | List files in destination folder |
| `/mediainfo [url/id]` | Analyze media file (video/audio details) |

### Favorites & History
| Command | Description |
|---------|-------------|
| `/favorites` | View your saved favorites |
| `/addfav [url/id]` | Add a file to favorites |
| `/removefav [id]` | Remove a file from favorites |
| `/recent` | View your recent activity |

### Utilities
| Command | Description |
|---------|-------------|
| `/ping` | Check bot status |
| `/qr [text]` | Generate QR code |
| `/shorturl [url]` | Create short URL |
| `/hash [text]` | Generate MD5/SHA-256 hashes |
| `/me` | View your profile & stats |
| `/quota` | Check your daily limits |
| `/settings` | Adjust your preferences |

### Advanced
| Command | Description |
|---------|-------------|
| `/batch [urls]` | Copy multiple files at once |
| `/share [url/id]` | Generate shareable link |
| `/clear` | Clear your recent activity |

### Admin Commands
| Command | Description |
|---------|-------------|
| `/stats` | Bot statistics |
| `/ban [user_id]` | Ban a user |
| `/unban [user_id]` | Unban a user |
| `/mkdir [name]` | Create a new folder |
| `/delete [file_id]` | Delete a file |
| `/rename [id] [name]` | Rename a file |
| `/broadcast [message]` | Send message to all users |
| `/authorize [user_id]` | Grant DM access |
| `/deauthorize [user_id]` | Revoke DM access |
| `/listauth` | List authorized users |

---

## 🚀 Deployment

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Cloudflare Account](https://dash.cloudflare.com/sign-up)
- [Telegram Bot Token](https://t.me/BotFather)
- [Google API Credentials](https://console.cloud.google.com/)

### Step 1: Clone & Install

```bash
git clone https://github.com/Zyforaa/Multifunction-TG-Bot-Cloudflare.git
cd Multifunction-TG-Bot-Cloudflare/tg-bot-advanced
npm install
```

### Step 2: Create KV Namespace

```bash
npx wrangler kv namespace create BOT_KV
```

Copy the ID and update `wrangler.jsonc`:
```jsonc
"kv_namespaces": [
  {
    "binding": "BOT_KV",
    "id": "YOUR_KV_NAMESPACE_ID"
  }
]
```

### Step 3: Configure Environment Variables

Edit `wrangler.jsonc` with your settings:
```jsonc
"vars": {
  "FOLDER_ID": "your-google-drive-folder-id",
  "INDEX_URL": "https://your-index.workers.dev",
  "OWNER_GITHUB": "https://github.com/yourusername",
  "OWNER_TELEGRAM": "yourusername",
  "AUTHORIZED_CHAT_ID": "-1001234567890",
  "ADMIN_USER_IDS": "123456789,987654321",
  "AUTHORIZED_USER_IDS": ""
}
```

### Step 4: Set Secrets

```bash
# Bot token from @BotFather
npx wrangler secret put BOT_TOKEN

# Google OAuth credentials
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET

# Get refresh token from https://bdi-generator.hashhackers.com/
npx wrangler secret put GOOGLE_REFRESH_TOKEN

# Optional: Webhook secret for added security
npx wrangler secret put WEBHOOK_SECRET

# Optional: Image generation for MediaInfo (htmlcsstoimage.com)
npx wrangler secret put HCTI_USER_ID
npx wrangler secret put HCTI_API_KEY
```

### Step 5: Deploy

```bash
npm run deploy
```

### Step 6: Set Webhook

Visit this URL in your browser (replace with your values):
```
https://your-worker.workers.dev/setWebhook?token=YOUR_BOT_TOKEN
```

Or use curl:
```bash
curl "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook?url=https://your-worker.workers.dev/webhook&secret_token=YOUR_WEBHOOK_SECRET"
```

---

## 🔧 Development

```bash
# Start dev server
npm run dev

# Run tests
npm test

# Type check
npx tsc --noEmit

# Generate types
npm run cf-typegen
```

---

## 📁 Project Structure

```
tg-bot-advanced/
├── src/
│   ├── index.ts              # Main entry point & webhook handler
│   ├── commands/             # Command handlers
│   │   ├── start.ts          # /start command
│   │   ├── help.ts           # /help with interactive menu
│   │   ├── search.ts         # /search with pagination
│   │   ├── copy.ts           # /copy command
│   │   ├── info.ts           # /info command
│   │   ├── list.ts           # /list command
│   │   ├── mediainfo.ts      # /mediainfo with WASM analysis
│   │   ├── advanced.ts       # Favorites, batch, share, recent
│   │   ├── utilities.ts      # /ping, /qr, /shorturl, /hash, /me
│   │   ├── admin.ts          # Admin commands
│   │   ├── router.ts         # Command routing & callbacks
│   │   └── types.ts          # Command context types
│   ├── services/             # External API clients
│   │   ├── telegram.ts       # Telegram Bot API client
│   │   ├── google-drive.ts   # Google Drive API client
│   │   ├── storage.ts        # KV storage service
│   │   ├── mediainfo.ts      # MediaInfo WASM integration
│   │   ├── mediainfo-image.ts # Visual MediaInfo image generator
│   │   └── pastebin.ts       # Pastebin upload service
│   ├── lib/                  # Vendored libraries
│   │   ├── mediainfo-bundle.js
│   │   └── MediaInfoModule.wasm
│   ├── middleware/           # Request processing
│   │   └── index.ts          # Auth, rate limiting, config
│   ├── types/                # TypeScript definitions
│   │   ├── telegram.ts       # Telegram API types
│   │   ├── google-drive.ts   # Google Drive types
│   │   └── env.ts            # Environment & config types
│   └── utils/                # Utility functions
│       ├── helpers.ts        # General helpers
│       └── logger.ts         # Structured logging
├── wrangler.jsonc            # Cloudflare Worker config
├── tsconfig.json             # TypeScript config
└── package.json              # Dependencies
```

---

## 🔐 Environment Variables

### Secrets (via `wrangler secret put`)
| Name | Description | Required |
|------|-------------|----------|
| `BOT_TOKEN` | Telegram Bot API token | ✅ |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | ✅ |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | ✅ |
| `GOOGLE_REFRESH_TOKEN` | Google OAuth Refresh Token | ✅ |
| `WEBHOOK_SECRET` | Secret for webhook verification | ❌ |
| `HCTI_USER_ID` | htmlcsstoimage.com User ID | ❌ |
| `HCTI_API_KEY` | htmlcsstoimage.com API Key | ❌ |

### Variables (in `wrangler.jsonc`)
| Name | Description | Required |
|------|-------------|----------|
| `FOLDER_ID` | Google Drive folder ID for cloning | ✅ |
| `INDEX_URL` | Your index URL for sharing files | ✅ |
| `OWNER_GITHUB` | Your GitHub profile URL | ❌ |
| `OWNER_TELEGRAM` | Your Telegram username | ❌ |
| `AUTHORIZED_CHAT_ID` | Restrict to specific chat | ❌ |
| `ADMIN_USER_IDS` | Comma-separated admin user IDs | ✅ |
| `AUTHORIZED_USER_IDS` | Users allowed in DMs | ❌ |

---

## 📊 KV Storage Schema

| Key Pattern | Description | TTL |
|-------------|-------------|-----|
| `user:{userId}` | User session & preferences | 30 days |
| `ratelimit:{userId}` | Rate limiting counters | 1 minute |
| `banned:{userId}` | Banned user record | Permanent |
| `authorized:{userId}` | Authorized user record | Permanent |
| `bot:stats` | Global bot statistics | Permanent |
| `cache:search:{query}` | Search result cache | 5 minutes |
| `pagination:{chatId}:{msgId}` | Pagination state | 1 hour |

---

## 🆘 Troubleshooting

### Bot not responding
1. Check webhook is set: `https://api.telegram.org/botTOKEN/getWebhookInfo`
2. Verify secrets are configured: `npx wrangler secret list`
3. Check Cloudflare Worker logs in dashboard

### Google Drive API errors
1. Verify refresh token is valid
2. Check Drive API is enabled in Google Console
3. Ensure client ID/secret are correct

### MediaInfo not working
1. Ensure the WASM file is properly bundled
2. Check file is accessible (not restricted)
3. MediaInfo works best with video/audio files

### Rate limiting issues
Default limits: 30 requests/min (general), 10 searches/min, 5 copies/min

---

## 📄 License

MIT License - See [LICENSE](../LICENSE) for details.

---

## 🙏 Credits

- Built with [Cloudflare Workers](https://workers.cloudflare.com/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Google Drive API](https://developers.google.com/drive/api)
- [MediaInfo](https://mediaarea.net/en/MediaInfo) WASM integration
- Made with ❤️ by **Zyfora**
