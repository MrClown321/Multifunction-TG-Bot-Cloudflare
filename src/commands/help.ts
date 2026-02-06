// /help command handler

import type { CommandHandler, CommandContext } from './types';

const commandHelp: Record<string, { usage: string; description: string; examples: string[] }> = {
  search: {
    usage: '/search [query]',
    description: 'Searches for files across all your connected Google Drives. You can use partial names, and I\'ll find anything that matches.',
    examples: ['/search Avatar 2022', '/search .mkv 1080p', '/search type:video avatar'],
  },
  copy: {
    usage: '/copy [url or file_id]',
    description: 'Clones a Google Drive file to your destination folder. Just paste the share link or file ID.',
    examples: [
      '/copy https://drive.google.com/file/d/xxx/view',
      '/copy 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs',
    ],
  },
  batch: {
    usage: '/batch [id1] [id2] [id3]...',
    description: 'Clone multiple files at once. Provide file IDs or links separated by spaces.',
    examples: ['/batch fileId1 fileId2 fileId3', '/batch https://drive.google.com/file/d/xxx https://drive.google.com/file/d/yyy'],
  },
  info: {
    usage: '/info [url or file_id]',
    description: 'Shows detailed information about a file including size, type, owner, and sharing status.',
    examples: ['/info https://drive.google.com/file/d/xxx/view'],
  },
  list: {
    usage: '/list [page] [filter]',
    description: 'Lists files in your destination folder. You can filter by type using keywords like video, audio, or document.',
    examples: ['/list', '/list 2', '/list video', '/list 1 document'],
  },
  share: {
    usage: '/share [file_id]',
    description: 'Generate shareable links for a file including Google Drive and index links.',
    examples: ['/share 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs'],
  },
  favorites: {
    usage: '/favorites',
    description: 'View your saved favorite files for quick access.',
    examples: ['/favorites'],
  },
  addfav: {
    usage: '/addfav [file_id]',
    description: 'Add a file to your favorites list. You can save up to 20 favorites.',
    examples: ['/addfav 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs'],
  },
  removefav: {
    usage: '/removefav [number]',
    description: 'Remove a file from your favorites by its list number.',
    examples: ['/removefav 3'],
  },
  recent: {
    usage: '/recent',
    description: 'View your recent activity including searches, copies, and file views.',
    examples: ['/recent'],
  },
  quota: {
    usage: '/quota',
    description: 'Check your daily usage limits and statistics.',
    examples: ['/quota'],
  },
  clear: {
    usage: '/clear',
    description: 'Clear your recent activity history.',
    examples: ['/clear'],
  },
  mediainfo: {
    usage: '/mediainfo [file_id or url]',
    description: 'Analyze a media file to get detailed technical information including video codec, resolution, frame rate, audio tracks, and more.',
    examples: ['/mediainfo 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs', '/mediainfo https://drive.google.com/file/d/xxx/view'],
  },
  mkdir: {
    usage: '/mkdir [folder_name]',
    description: 'Creates a new folder in your destination folder.',
    examples: ['/mkdir Movies 2024', '/mkdir Backups'],
  },
  rename: {
    usage: '/rename [file_id] [new_name]',
    description: 'Renames a file in Google Drive. The file ID is the long string you see in URLs.',
    examples: ['/rename 1BxiMVs0XRA My-Movie-2024.mp4'],
  },
  delete: {
    usage: '/delete [file_id]',
    description: 'Permanently deletes a file. This requires admin privileges and cannot be undone.',
    examples: ['/delete 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs'],
  },
  qr: {
    usage: '/qr [text or url]',
    description: 'Generates a QR code image for any text or URL you provide.',
    examples: ['/qr https://google.com', '/qr Hello World'],
  },
  shorturl: {
    usage: '/shorturl [url]',
    description: 'Creates a shortened URL using TinyURL. Great for sharing long links.',
    examples: ['/shorturl https://example.com/very/long/url/path'],
  },
  hash: {
    usage: '/hash [text]',
    description: 'Generates MD5 and SHA-256 hashes for any text. Useful for verification.',
    examples: ['/hash mypassword123', '/hash some important text'],
  },
  me: {
    usage: '/me',
    description: 'Shows your profile information and usage statistics.',
    examples: ['/me'],
  },
  settings: {
    usage: '/settings',
    description: 'Opens your preferences panel where you can adjust notification and display settings.',
    examples: ['/settings'],
  },
  stats: {
    usage: '/stats',
    description: 'Shows overall bot statistics. Only available to administrators.',
    examples: ['/stats'],
  },
  ban: {
    usage: '/ban [user_id] [reason]',
    description: 'Bans a user from using the bot. Admin only.',
    examples: ['/ban 123456789 Spamming'],
  },
  unban: {
    usage: '/unban [user_id]',
    description: 'Removes a ban from a user. Admin only.',
    examples: ['/unban 123456789'],
  },
  broadcast: {
    usage: '/broadcast [message]',
    description: 'Sends a message to all users. Admin only.',
    examples: ['/broadcast Maintenance scheduled for tonight.'],
  },
  authorize: {
    usage: '/authorize [user_id]',
    description: 'Grant a user permission to use the bot in private messages. Admin only.',
    examples: ['/authorize 123456789'],
  },
  deauthorize: {
    usage: '/deauthorize [user_id]',
    description: 'Revoke a user\'s DM access. Admin only.',
    examples: ['/deauthorize 123456789'],
  },
  listauth: {
    usage: '/listauth',
    description: 'List all users authorized to use the bot in DMs. Admin only.',
    examples: ['/listauth'],
  },
};

export const helpCommand: CommandHandler = {
  command: 'help',
  description: 'Get help about commands',
  usage: '/help [command]',

  async handle(ctx: CommandContext): Promise<void> {
    const { message, telegram, args } = ctx;
    const chatId = message.chat.id;

    if (args && commandHelp[args.toLowerCase()]) {
      const cmd = commandHelp[args.toLowerCase()];
      const helpText = `
<b>Command: /${args.toLowerCase()}</b>

<b>How to use it:</b>
<code>${cmd.usage}</code>

<b>What it does:</b>
${cmd.description}

<b>Examples:</b>
${cmd.examples.map((e) => `  <code>${e}</code>`).join('\n')}

Need help with something else? Just type /help to see all commands.
`;
      await telegram.sendMessage({
        chat_id: chatId,
        text: helpText,
        reply_to_message_id: message.message_id,
      });
      return;
    }

    const helpText = `
<b>Command Reference</b>

I've organized everything by category to make it easier to find what you need.

<b>Search and Copy</b>
/search - Find files in your drives
/copy - Clone a file to your folder
/batch - Clone multiple files at once
/info - Get file details
/share - Generate share links

<b>File Management</b>
/list - Browse your folder
/mkdir - Create a folder
/rename - Rename a file
/delete - Remove a file

<b>Favorites and History</b>
/favorites - View saved favorites
/addfav - Add a file to favorites
/removefav - Remove from favorites
/recent - Your recent activity
/clear - Clear activity history

<b>Utilities</b>
/qr - Generate QR codes
/shorturl - Shorten URLs
/hash - Generate hashes
/mediainfo - Media file analysis
/ping - Check bot status

<b>Your Account</b>
/me - Your profile and stats
/quota - Your usage limits
/settings - Your preferences

<b>Admin Commands</b>
/stats - Bot statistics
/ban - Ban a user
/unban - Unban a user
/authorize - Grant DM access
/deauthorize - Revoke DM access
/listauth - List authorized users
/broadcast - Message all users

For detailed help on any command, type:
<code>/help [command]</code>

For example: <code>/help search</code>
`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: 'Search Help', callback_data: 'help:search' },
          { text: 'Copy Help', callback_data: 'help:copy' },
        ],
        [
          { text: 'List Help', callback_data: 'help:list' },
          { text: 'Utilities', callback_data: 'help:utils' },
        ],
        [{ text: 'Close', callback_data: 'close' }],
      ],
    };

    await telegram.sendWithKeyboard(chatId, helpText, keyboard, message.message_id);
  },
};
