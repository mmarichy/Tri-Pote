import { roomUrl } from "../url";

interface RoomCodeBannerProps {
  code: string;
}

export function RoomCodeBanner({ code }: RoomCodeBannerProps) {
  const link = roomUrl(code);

  const copyCode = () => navigator.clipboard.writeText(code);
  const copyLink = () => navigator.clipboard.writeText(link);

  return (
    <div className="uc-card text-center">
      <p className="uc-hint mb-1">Code de la partie</p>
      <p className="font-display text-3xl font-bold tracking-[0.3em] text-undercover-accent">
        {code}
      </p>
      <div className="mt-4 flex gap-2">
        <button className="uc-btn-secondary flex-1 text-sm" type="button" onClick={copyCode}>
          Copier le code
        </button>
        <button className="uc-btn-secondary flex-1 text-sm" type="button" onClick={copyLink}>
          Copier le lien
        </button>
      </div>
      <p className="uc-hint mt-3">
        Partage ce code pour que tes amis rejoignent la partie.
      </p>
    </div>
  );
}
