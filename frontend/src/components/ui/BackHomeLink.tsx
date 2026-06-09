import { Link } from 'react-router-dom';

export default function BackHomeLink() {
  return (
    <Link
      to="/"
      className="inline-flex items-center justify-center px-5 py-2 rounded-full text-sm font-medium text-gray-400 border border-navy-border/80 bg-navy-light/40 hover:text-gold hover:border-gold/40 hover:bg-navy-light transition-all duration-200"
    >
      Back to homepage
    </Link>
  );
}
