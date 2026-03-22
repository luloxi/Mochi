import Link from "next/link";
import { listArtistProfiles } from "@/lib/artist-profiles-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string }>;

function walletShort(value: string) {
  if (!value) return "-";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export default async function MarketplaceArtistsIndexPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q } = await searchParams;
  const search = String(q || "").trim().slice(0, 120);
  const profiles = await listArtistProfiles({ search: search || undefined }).catch(() => []);

  return (
    <main className="min-h-screen overflow-x-hidden neural-shell">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-8 pt-28 md:px-6 lg:px-8">
        <section className="rounded-3xl border border-border bg-white/10 p-5 backdrop-blur-sm md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-foreground md:text-3xl">
                Artists / Artistas
              </h1>
            </div>
            <Link
              href="/marketplace"
              className="inline-flex items-center justify-center rounded-md border border-border bg-white/5 px-3 py-2 text-sm text-foreground hover:bg-white/10"
            >
              Back to marketplace
            </Link>
          </div>

          <form action="/marketplace/artists" method="get" className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              type="search"
              name="q"
              defaultValue={search}
              placeholder="Search artist, style, wallet..."
              className="w-full rounded-lg border border-border bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md border border-border bg-white/5 px-4 py-2 text-sm text-foreground hover:bg-white/10"
            >
              Search
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-border bg-white/10 p-4 md:p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">
              Results ({profiles.length})
            </h2>
            {search ? (
              <p className="text-xs text-muted-foreground">Filter: {search}</p>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {profiles.map((profile) => (
              <article
                key={profile.walletAddress}
                className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-white/5 p-4"
              >
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {profile.displayName || walletShort(profile.walletAddress)}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">{walletShort(profile.walletAddress)}</p>
                </div>

                <div className="flex flex-wrap gap-2 text-[11px]">
                  {profile.artistEnabled ? (
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-foreground">
                      Artist
                    </span>
                  ) : null}
                  {profile.commissionEnabled ? (
                    <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-2 py-0.5 text-foreground">
                      {profile.acceptingNewClients ? "Commissions open" : "Commissions closed"}
                    </span>
                  ) : null}
                </div>

                {profile.styleTags.length ? (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    Styles: <span className="text-foreground">{profile.styleTags.join(", ")}</span>
                  </p>
                ) : null}
                {profile.bio ? (
                  <p className="text-xs text-muted-foreground line-clamp-3">{profile.bio}</p>
                ) : null}

                <div className="mt-auto grid gap-2">
                  <Link
                    href={`/profile/${profile.walletAddress}`}
                    className="inline-flex items-center justify-center rounded-md border border-border bg-white/5 px-3 py-2 text-sm text-foreground hover:bg-white/10"
                  >
                    View artist page
                  </Link>
                  <Link
                    href={`/marketplace/artist/${profile.walletAddress}/collection`}
                    className="inline-flex items-center justify-center rounded-md border border-border bg-white/5 px-3 py-2 text-sm text-foreground hover:bg-white/10"
                  >
                    View wallet collection
                  </Link>
                </div>
              </article>
            ))}
          </div>

          {profiles.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border bg-white/5 p-6 text-center text-sm text-muted-foreground">
              No artist profiles found.
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
