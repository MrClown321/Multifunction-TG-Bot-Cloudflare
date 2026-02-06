// MediaInfo Command Handler Wrapper
// Wraps the mediainfo function to match the CommandHandler interface

import type { CommandHandler, CommandContext } from './types';
import { mediainfoCommand } from './mediainfo';

export const mediainfoCommandHandler: CommandHandler = {
  command: 'mediainfo',
  description: 'Analyze media file technical details (codec, resolution, bitrate, etc.)',
  usage: '/mediainfo <file_id_or_url>',
  adminOnly: false,
  
  async handle(ctx: CommandContext): Promise<void> {
    await mediainfoCommand(
      ctx.message,
      ctx.telegram,
      ctx.drive,
      ctx.env,
      ctx.config
    );
  },
};
