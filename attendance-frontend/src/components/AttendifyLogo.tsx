import { motion } from 'framer-motion';

interface AttendifyLogoProps {
    size?: number;
    className?: string;
}

const AttendifyLogo: React.FC<AttendifyLogoProps> = ({ size = 28, className = '' }) => {
    return (
        <motion.svg
            width={size}
            height={size}
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            whileHover={{ scale: 1.1 }}
            transition={{ type: 'spring', stiffness: 400 }}
        >
            <defs>
                <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="50%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#d946ef" />
                </linearGradient>
                <linearGradient id="checkGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#34d399" />
                </linearGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {/* Face circle background */}
            <circle cx="32" cy="28" r="22" fill="url(#logoGradient)" filter="url(#glow)" />

            {/* Stylized face - simplified */}
            <circle cx="26" cy="25" r="2.5" fill="white" opacity="0.9" />
            <circle cx="38" cy="25" r="2.5" fill="white" opacity="0.9" />

            {/* Smile */}
            <path
                d="M25 32 Q32 38 39 32"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
                opacity="0.9"
            />

            {/* Checkmark badge */}
            <circle cx="48" cy="48" r="12" fill="url(#checkGradient)" stroke="white" strokeWidth="3" />
            <motion.path
                d="M42 48 L46 52 L54 44"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
            />
        </motion.svg>
    );
};

export default AttendifyLogo;
