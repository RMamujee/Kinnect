import { NextRequest, NextResponse } from 'next/server';

/**
 * FamilySearch OAuth 2.0 callback handler
 * After user authorizes at FamilySearch, they are redirected here with ?code=...
 * We exchange the code for an access token and store it in a cookie.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      new URL(`/tree?auth_error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(new URL('/tree?auth_error=no_code', request.url));
  }

  const clientId = process.env.FAMILYSEARCH_CLIENT_ID;
  const clientSecret = process.env.FAMILYSEARCH_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/tree?auth_error=misconfigured', request.url));
  }

  try {
    const tokenRes = await fetch('https://ident.familysearch.org/cis-web/oauth2/v3/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${appUrl}/api/familysearch/callback`,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenRes.ok) {
      throw new Error(`Token exchange failed: ${tokenRes.status}`);
    }

    const tokenData = await tokenRes.json();
    const accessToken: string = tokenData.access_token;
    const expiresIn: number = tokenData.expires_in ?? 3600;

    const response = NextResponse.redirect(new URL('/tree?auth=success', request.url));
    response.cookies.set('fs_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expiresIn,
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('FamilySearch token exchange error:', err);
    return NextResponse.redirect(new URL('/tree?auth_error=token_failed', request.url));
  }
}
