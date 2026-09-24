import T from "@/components/T";

/**
 * What a product without its own photo shows instead of another shoe's picture.
 *
 * Fills whatever box it is put in. The crest-and-name treatment is the shop's
 * own, so a card waiting for its photo still reads as KRISHOE rather than as a
 * broken image.
 */
export default function NoPhotoYet({ name }: { name: string }) {
  return (
    <span
      role="img"
      aria-label={`${name} — photo coming soon`}
      className="absolute inset-0 grid place-items-center bg-[radial-gradient(120%_100%_at_30%_10%,#FBF4E6,#E8F2EC)]"
    >
      <span className="grid justify-items-center gap-2 px-4 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[linear-gradient(150deg,#e3c684,#c9a24b)] text-xl font-black text-brand-green-ink shadow-sm">
          K
        </span>
        <span className="text-xs font-black uppercase tracking-[0.2em] text-brand-green-ink">KRISHOE</span>
        <span className="text-xs font-semibold text-brand-muted">
          <T en="Photo coming soon" ne="फोटो छिट्टै आउँदैछ" />
        </span>
      </span>
    </span>
  );
}
