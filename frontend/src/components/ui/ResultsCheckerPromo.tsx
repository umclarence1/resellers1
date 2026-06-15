const RESULTS_CHECKER_URL = 'https://waeccheckersgh.com';

export default function ResultsCheckerPromo() {
  return (
    <a
      href={RESULTS_CHECKER_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg sm:rounded-xl text-sm font-medium text-violet-200 border border-violet-400/35 bg-violet-500/10 hover:bg-violet-500/20 hover:border-violet-300/50 hover:text-white transition-all duration-200"
    >
      Buy Results Checker
    </a>
  );
}
