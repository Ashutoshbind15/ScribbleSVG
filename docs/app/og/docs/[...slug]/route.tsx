import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getPageImage, source } from '@/lib/source';
import { notFound } from 'next/navigation';
import { ImageResponse } from 'next/og';
import { generate as DefaultImage } from 'fumadocs-ui/og';
import { appName } from '@/lib/shared';

export const revalidate = false;

const iconPromise = readFile(join(process.cwd(), 'public/brand/icon.png'));

export async function GET(_req: Request, { params }: RouteContext<'/og/docs/[...slug]'>) {
  const { slug } = await params;
  const page = source.getPage(slug.slice(0, -1));
  if (!page) notFound();

  const iconData = await iconPromise;
  const iconSrc = `data:image/png;base64,${iconData.toString('base64')}`;

  return new ImageResponse(
    (
      <DefaultImage
        title={page.data.title}
        description={page.data.description}
        site={appName}
        primaryColor="rgba(244,244,245,0.25)"
        primaryTextColor="rgb(244,244,245)"
        icon={
          // eslint-disable-next-line @next/next/no-img-element -- next/og ImageResponse
          <img src={iconSrc} width={56} height={56} alt="" style={{ borderRadius: 12 }} />
        }
      />
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}

export function generateStaticParams() {
  return source.getPages().map((page) => ({
    lang: page.locale,
    slug: getPageImage(page).segments,
  }));
}
