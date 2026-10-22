import { Controller, Get, Inject, Param, Query, Req, Res } from '@nestjs/common';
import type { Request, Response, CookieOptions } from 'express';
import { AuthService, opaque } from './auth.service.js';
import { OAuthService, providerName } from './oauth.service.js';
import { authConfig } from './config.js';

@Controller('auth')
export class OAuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService, @Inject(OAuthService) private readonly oauth: OAuthService) {}
  private options(): CookieOptions {
    const c=authConfig(); return { httpOnly:true, secure:c.secure, sameSite:c.sameSite, path:'/auth' };
  }
  @Get(':provider/start')
  async start(@Param('provider') value: string, @Req() req: Request, @Res() res: Response) {
    const provider=providerName(value);
    await this.auth.rateLimit(req.ip ?? 'unknown','oauth');
    const browser=opaque();
    try {
      const url=await this.oauth.start(provider,browser);
      res.cookie('chainops_oauth',browser,{ ...this.options(),sameSite:'lax',maxAge:600000 });
      res.redirect(url);
    } catch { res.redirect(`${authConfig().origin}/login?error=provider_unavailable`); }
  }
  @Get(':provider/callback')
  async callback(@Param('provider') value: string, @Query() query: Record<string,unknown>, @Req() req: Request, @Res() res: Response) {
    res.clearCookie('chainops_oauth',{ ...this.options(),sameSite:'lax' });
    try {
      const tokens=await this.oauth.callback(providerName(value),query.state,query.code,(req.cookies as Record<string,string> | undefined)?.chainops_oauth);
      const profile=await this.auth.current(tokens.access);
      res.cookie('chainops_access',tokens.access,{ ...this.options(),maxAge:600000 });
      res.cookie('chainops_refresh',tokens.refresh,{ ...this.options(),maxAge:30*86400000 });
      res.redirect(`${authConfig().origin}${profile.nextPath}`);
    } catch { res.redirect(`${authConfig().origin}/login?error=provider_failed`); }
  }
}
