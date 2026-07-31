import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { SiteContentService } from './site-content.service';

@ApiTags('site-content')
@Controller('site-content')
export class SiteContentPublicController {
  constructor(private readonly content: SiteContentService) {}

  @Get('home')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'محتوای CMS صفحهٔ اصلی' })
  async home() {
    return { success: true, data: await this.content.getPublicHome() };
  }

  @Get('media/:fileId')
  @Throttle({ default: { limit: 240, ttl: 60_000 } })
  @ApiOperation({ summary: 'دریافت تصویر محتوای سایت' })
  async media(@Param('fileId') fileId: string, @Res() res: Response) {
    const { mimeType, fileName, stream } =
      await this.content.readPublicMedia(fileId);
    res.setHeader('Content-Type', mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );
    stream.pipe(res);
  }
}
