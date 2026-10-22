import { Body, Controller, Get, Post, Req, Res, ForbiddenException, Inject } from '@nestjs/common';
import type { Request, Response, CookieOptions } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { AuthService, opaque } from './auth.service.js';
import { authConfig } from './config.js';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  protected options(): CookieOptions {
    const c = authConfig();
    return { httpOnly: true, secure: c.secure, sameSite: c.sameSite, path: '/auth' };
  }
  protected cookies(req: Request): Record<string,string> { return (req.cookies ?? {}) as Record<string,string>; }
  private csrf(req: Request) {
    const cookie = this.cookies(req).chainops_csrf, header = req.get('X-CSRF-Token');
    if (req.get('origin') !== authConfig().origin || !cookie || !header || !/^[\w-]{43}$/.test(cookie) || !/^[\w-]{43}$/.test(header) || !timingSafeEqual(Buffer.from(cookie),Buffer.from(header))) throw new ForbiddenException('Invalid request origin or CSRF token');
  }
  protected session(res: Response, tokens: { access: string; refresh: string }) {
    res.cookie('chainops_access',tokens.access,{ ...this.options(), maxAge: 600000 });
    res.cookie('chainops_refresh',tokens.refresh,{ ...this.options(), maxAge: 30*86400000 });
  }
  private clear(res: Response) {
    for (const name of ['chainops_access','chainops_refresh','chainops_csrf','chainops_oauth']) res.clearCookie(name,this.options());
  }
  @Get('csrf')
  csrfToken(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const existing = this.cookies(req).chainops_csrf;
    const token = existing && /^[\w-]{43}$/.test(existing) ? existing : opaque();
    res.setHeader('Cache-Control','no-store');
    res.cookie('chainops_csrf',token,{ ...this.options(), maxAge: 86400000 });
    return { csrfToken: token };
  }
  @Post('register')
  async register(@Req() req: Request, @Body() body: unknown) { this.csrf(req); await this.auth.rateLimit(req.ip ?? 'unknown','register'); return this.auth.register(body); }
  @Post('login')
  async login(@Req() req: Request, @Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    this.csrf(req); await this.auth.rateLimit(req.ip ?? 'unknown','login');
    const tokens = await this.auth.login(body);
    this.session(res,tokens);
    return this.auth.current(tokens.access);
  }
  @Get('me')
  current(@Req() req: Request) { return this.auth.current(this.cookies(req).chainops_access); }
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.csrf(req);
    try { this.session(res,await this.auth.refresh(this.cookies(req).chainops_refresh)); return { ok: true }; }
    catch (error) { this.clear(res); throw error; }
  }
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) { this.csrf(req); await this.auth.logout(this.cookies(req).chainops_refresh); this.clear(res); return { ok: true }; }
  @Post('sessions/revoke')
  async revoke(@Req() req: Request, @Res({ passthrough: true }) res: Response) { this.csrf(req); await this.auth.revokeAll(this.cookies(req).chainops_access); this.clear(res); return { ok: true }; }
  @Post('verify-email')
  async verify(@Req() req: Request, @Body() body: { token?: unknown }) { this.csrf(req); await this.auth.rateLimit(req.ip ?? 'unknown','verify'); return this.auth.verifyEmail(body?.token); }
  @Post('verification/resend')
  async resend(@Req() req: Request, @Body() body: unknown) { this.csrf(req); await this.auth.rateLimit(req.ip ?? 'unknown','resend'); return this.auth.resend(body); }
}
