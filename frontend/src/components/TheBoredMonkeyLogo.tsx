'use client';

import React from 'react';

interface TheBoredMonkeyLogoProps {
  className?: string;
  width?: number | string;
  height?: number | string;
  showSubtitle?: boolean;
}

/**
 * TheBoredMonkey Official Animated Brand Logo
 * 100% Mathematical Vector SVG — Razor-sharp on 4K, Retina, and all screens.
 * Zero raster blur, zero compression artifacts, butter-smooth 60fps CSS animation.
 */
export default function TheBoredMonkeyLogo({
  className = '',
  width = '100%',
  height = '100%',
  showSubtitle = true,
}: TheBoredMonkeyLogoProps) {
  return (
    <div
      className={`tbm-logo-wrapper ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    >
      <svg
        viewBox="0 0 1380 250"
        xmlns="http://www.w3.org/2000/svg"
        className="tbm-vector-svg"
        role="img"
        aria-label="TheBoredMonkey - Creations & Connections"
        style={{
          width: '100%',
          height: '100%',
          maxWidth: '100%',
          maxHeight: '100%',
          display: 'block',
          overflow: 'visible',
        }}
      >
        <defs>
          {/* High-vibrancy brand gradient for connecting wire */}
          <linearGradient id="tbmWireGradVector" x1="455" y1="19" x2="960" y2="19" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>

          {/* Circuit electric glow filters */}
          <filter id="tbmYellowGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#f59e0b" floodOpacity="0.5" />
          </filter>
          <filter id="tbmOrangeGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#ea580c" floodOpacity="0.5" />
          </filter>

          <style>{`
            .tbm-wire-guide {
              stroke: #fed7aa;
              stroke-width: 8px;
              opacity: 0.35;
            }
            .tbm-wire-active {
              stroke-dasharray: 640;
              stroke-dashoffset: 640;
              animation: tbmWireDraw 3.6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
            }
            @keyframes tbmWireDraw {
              0% {
                stroke-dashoffset: 640;
                opacity: 0.2;
              }
              8% {
                opacity: 1;
              }
              34% {
                stroke-dashoffset: 0;
                opacity: 1;
              }
              78% {
                stroke-dashoffset: 0;
                opacity: 1;
              }
              90% {
                stroke-dashoffset: 0;
                opacity: 0.3;
              }
              100% {
                stroke-dashoffset: 640;
                opacity: 0.2;
              }
            }

            .tbm-yellow-ring {
              transform-origin: 455px 127px;
              animation: tbmYellowPulse 3.6s ease-in-out infinite;
            }
            @keyframes tbmYellowPulse {
              0% {
                filter: drop-shadow(0 0 2px rgba(245, 158, 11, 0.3));
                stroke-width: 24px;
              }
              10% {
                filter: drop-shadow(0 0 10px rgba(245, 158, 11, 0.85));
                stroke-width: 26px;
              }
              28% {
                filter: drop-shadow(0 0 4px rgba(245, 158, 11, 0.4));
                stroke-width: 24px;
              }
              42% {
                filter: drop-shadow(0 0 9px rgba(245, 158, 11, 0.75));
              }
              75% {
                filter: drop-shadow(0 0 4px rgba(245, 158, 11, 0.3));
              }
              100% {
                filter: drop-shadow(0 0 2px rgba(245, 158, 11, 0.3));
              }
            }

            .tbm-orange-ring {
              transform-origin: 960px 127px;
              animation: tbmOrangePulse 3.6s ease-in-out infinite;
            }
            @keyframes tbmOrangePulse {
              0%, 26% {
                filter: drop-shadow(0 0 2px rgba(234, 88, 12, 0.3));
                stroke-width: 24px;
              }
              38% {
                filter: drop-shadow(0 0 12px rgba(234, 88, 12, 0.9));
                stroke-width: 26px;
              }
              50% {
                filter: drop-shadow(0 0 5px rgba(234, 88, 12, 0.5));
                stroke-width: 24px;
              }
              75% {
                filter: drop-shadow(0 0 4px rgba(234, 88, 12, 0.3));
              }
              100% {
                filter: drop-shadow(0 0 2px rgba(234, 88, 12, 0.3));
              }
            }

            .tbm-sub-text {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, sans-serif;
              font-weight: 700;
              font-size: 43px;
              letter-spacing: 0.22em;
              fill: #b45309;
              animation: tbmSubGlow 3.6s ease-in-out infinite;
            }
            @keyframes tbmSubGlow {
              0%, 100% { opacity: 0.9; }
              40%, 75% { opacity: 1; fill: #9a3412; }
            }
          `}</style>
        </defs>

        {/* 1. Underlying Conduit / Wire Guide */}
        <path
          className="tbm-wire-guide"
          d="M 455 83 L 455 24 Q 455 19 460 19 L 955 19 Q 960 19 960 24 L 960 83"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* 2. Flowing Electric Circuit Wire */}
        <path
          className="tbm-wire-active"
          d="M 455 83 L 455 24 Q 455 19 460 19 L 955 19 Q 960 19 960 24 L 960 83"
          fill="none"
          stroke="url(#tbmWireGradVector)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* 3. Official Master Wordmark Typography (TheB, redM, nkey) */}
        <path
          d="M 1291 86 L 1289 88 L 1289 90 L 1292 94 L 1292 99 L 1296 103 L 1296 108 L 1297 113 L 1301 117 L 1301 122 L 1302 124 L 1305 127 L 1306 130 L 1306 136 L 1307 138 L 1310 141 L 1311 148 L 1315 154 L 1315 159 L 1320 166 L 1320 174 L 1338 174 L 1339 172 L 1339 169 L 1343 165 L 1343 160 L 1344 157 L 1347 153 L 1348 150 L 1348 146 L 1349 144 L 1352 141 L 1352 134 L 1353 131 L 1357 127 L 1357 122 L 1361 117 L 1362 114 L 1362 108 L 1366 104 L 1367 96 L 1370 92 L 1370 87 L 1349 87 L 1348 89 L 1347 94 L 1344 97 L 1343 100 L 1343 106 L 1339 112 L 1339 117 L 1338 120 L 1334 126 L 1334 132 L 1333 134 L 1331 135 L 1325 127 L 1324 124 L 1324 119 L 1323 117 L 1320 114 L 1320 109 L 1319 105 L 1315 100 L 1315 94 L 1313 90 L 1310 87 L 1308 86 Z M 1232 83 L 1226 87 L 1223 87 L 1214 92 L 1204 102 L 1203 104 L 1203 108 L 1199 112 L 1198 114 L 1198 141 L 1202 147 L 1203 151 L 1208 157 L 1218 166 L 1227 171 L 1237 172 L 1248 172 L 1262 171 L 1265 168 L 1271 166 L 1277 159 L 1266 148 L 1264 148 L 1260 150 L 1256 153 L 1247 154 L 1241 154 L 1240 153 L 1233 153 L 1225 146 L 1225 145 L 1222 142 L 1222 140 L 1224 138 L 1284 138 L 1287 134 L 1287 113 L 1286 111 L 1283 108 L 1282 103 L 1271 92 L 1266 88 L 1263 87 L 1259 87 L 1255 84 L 1250 82 L 1240 82 Z M 1221 113 L 1228 106 L 1237 101 L 1249 101 L 1251 102 L 1254 105 L 1257 106 L 1264 113 L 1264 117 L 1261 120 L 1224 120 L 1221 117 Z M 1085 88 L 1079 86 L 1076 83 L 1072 82 L 1061 82 L 1057 83 L 1055 84 L 1052 87 L 1049 88 L 1044 88 L 1041 86 L 1023 86 L 1021 87 L 1020 89 L 1020 169 L 1022 171 L 1041 171 L 1043 169 L 1043 109 L 1045 106 L 1054 101 L 1066 101 L 1069 102 L 1076 108 L 1077 117 L 1078 170 L 1080 171 L 1097 171 L 1099 170 L 1099 106 L 1094 97 Z M 602 87 L 595 92 L 592 96 L 591 96 L 589 98 L 589 99 L 585 102 L 580 109 L 579 120 L 576 125 L 576 130 L 579 135 L 579 140 L 580 146 L 584 150 L 584 153 L 585 155 L 591 162 L 597 166 L 600 166 L 602 168 L 603 168 L 604 170 L 606 171 L 617 171 L 618 172 L 628 172 L 642 171 L 644 170 L 646 167 L 649 166 L 652 166 L 656 162 L 657 159 L 647 149 L 643 148 L 641 149 L 639 152 L 637 153 L 627 154 L 621 154 L 610 152 L 603 146 L 603 144 L 602 142 L 605 138 L 666 138 L 668 136 L 668 115 L 667 113 L 664 110 L 663 105 L 659 99 L 652 92 L 646 90 L 643 87 L 639 87 L 633 83 L 628 82 L 616 82 L 612 83 L 606 87 Z M 600 116 L 603 112 L 610 105 L 616 101 L 629 101 L 633 105 L 638 106 L 643 112 L 645 117 L 642 120 L 603 120 L 601 119 Z M 558 83 L 553 82 L 544 83 L 535 91 L 530 86 L 512 86 L 510 88 L 509 91 L 509 168 L 510 170 L 532 170 L 532 114 L 533 112 L 539 106 L 541 105 L 552 105 L 554 106 L 558 110 L 562 110 L 565 107 L 565 104 L 569 100 L 570 98 L 570 93 L 567 89 L 564 87 L 561 86 Z M 238 83 L 235 86 L 232 87 L 229 87 L 225 89 L 223 91 L 220 92 L 214 98 L 210 103 L 209 105 L 209 108 L 205 112 L 205 143 L 210 152 L 214 157 L 224 166 L 233 171 L 244 172 L 268 171 L 270 170 L 273 167 L 276 167 L 278 166 L 283 161 L 283 158 L 274 149 L 272 148 L 267 149 L 263 153 L 253 154 L 247 154 L 240 153 L 236 151 L 230 146 L 228 141 L 231 138 L 291 138 L 293 136 L 293 112 L 289 108 L 289 105 L 284 98 L 278 92 L 275 91 L 273 89 L 269 87 L 266 87 L 263 86 L 260 83 L 254 82 L 243 82 Z M 228 113 L 234 106 L 237 105 L 239 103 L 243 101 L 255 101 L 257 102 L 260 105 L 262 105 L 265 107 L 265 108 L 270 112 L 270 118 L 268 120 L 231 120 L 229 119 Z M 13 55 L 13 71 L 15 73 L 43 73 L 45 75 L 45 167 L 47 171 L 68 170 L 68 78 L 69 75 L 71 73 L 99 73 L 101 71 L 101 56 L 100 54 Z M 781 56 L 781 169 L 783 171 L 802 171 L 804 169 L 804 99 L 807 97 L 810 100 L 813 105 L 814 109 L 818 113 L 818 116 L 819 118 L 823 122 L 823 125 L 824 127 L 827 130 L 833 142 L 836 145 L 837 147 L 837 150 L 840 152 L 846 146 L 847 144 L 847 142 L 850 139 L 851 136 L 855 132 L 856 127 L 860 123 L 861 118 L 866 112 L 866 111 L 868 110 L 870 106 L 870 103 L 874 100 L 875 97 L 877 95 L 879 97 L 879 169 L 881 171 L 897 171 L 899 170 L 901 166 L 901 58 L 898 54 L 896 53 L 877 53 L 866 66 L 865 71 L 861 75 L 861 78 L 860 80 L 856 84 L 852 91 L 852 93 L 851 95 L 848 97 L 847 99 L 847 102 L 846 104 L 842 107 L 839 107 L 837 105 L 837 103 L 833 99 L 833 96 L 831 92 L 828 90 L 827 85 L 826 83 L 823 80 L 821 74 L 818 71 L 815 66 L 813 60 L 812 59 L 811 59 L 806 53 L 784 53 Z M 315 53 L 312 57 L 312 168 L 313 170 L 368 171 L 374 167 L 380 166 L 385 162 L 391 155 L 392 150 L 396 144 L 396 130 L 393 126 L 392 122 L 387 117 L 382 110 L 382 106 L 383 104 L 386 101 L 387 99 L 387 94 L 391 88 L 391 83 L 390 80 L 388 78 L 387 75 L 387 70 L 372 55 L 369 54 L 355 53 Z M 336 121 L 362 120 L 369 127 L 373 133 L 373 137 L 370 141 L 369 145 L 366 148 L 361 149 L 358 152 L 354 153 L 339 153 L 337 152 L 335 150 L 335 123 Z M 338 68 L 350 68 L 358 73 L 362 73 L 364 75 L 364 78 L 365 80 L 368 83 L 369 88 L 364 95 L 358 101 L 338 101 L 335 98 L 335 71 Z M 1118 50 L 1115 53 L 1115 168 L 1118 171 L 1135 171 L 1137 169 L 1138 135 L 1140 135 L 1146 140 L 1161 160 L 1172 171 L 1193 171 L 1195 170 L 1195 168 L 1194 166 L 1188 159 L 1184 156 L 1160 131 L 1158 128 L 1158 126 L 1160 122 L 1162 120 L 1163 120 L 1165 118 L 1165 117 L 1167 115 L 1168 115 L 1178 103 L 1180 99 L 1188 90 L 1188 88 L 1186 86 L 1169 86 L 1167 87 L 1160 95 L 1152 102 L 1151 105 L 1147 109 L 1147 111 L 1146 113 L 1140 119 L 1137 118 L 1137 52 L 1135 50 Z M 113 50 L 111 52 L 111 169 L 113 171 L 132 171 L 134 169 L 134 108 L 141 102 L 144 101 L 157 101 L 159 102 L 162 105 L 165 106 L 167 109 L 167 168 L 168 170 L 188 171 L 190 169 L 190 108 L 186 102 L 186 99 L 180 92 L 174 87 L 170 86 L 167 83 L 163 82 L 151 82 L 146 83 L 143 86 L 141 87 L 135 86 L 134 84 L 134 52 L 133 50 Z M 761 50 L 759 50 L 758 49 L 742 49 L 740 50 L 739 84 L 736 87 L 730 83 L 726 82 L 714 82 L 711 83 L 705 87 L 703 87 L 693 93 L 688 99 L 687 101 L 687 103 L 683 107 L 682 114 L 678 120 L 678 136 L 679 138 L 682 141 L 683 145 L 683 150 L 687 155 L 699 167 L 705 171 L 723 172 L 733 171 L 735 169 L 737 169 L 740 171 L 760 171 L 762 169 L 762 52 Z M 718 101 L 730 101 L 737 106 L 739 109 L 739 146 L 738 149 L 735 152 L 732 153 L 714 153 L 712 152 L 706 146 L 701 139 L 701 117 L 705 113 L 706 109 L 709 106 L 714 105 Z"
          fill="#0f172a"
          fillRule="evenodd"
        />

        {/* 4. Yellow 'o' Ring (Bored) */}
        <circle
          className="tbm-yellow-ring"
          cx="455"
          cy="127"
          r="44"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="24"
        />

        {/* 5. Orange 'o' Ring (Monkey) */}
        <circle
          className="tbm-orange-ring"
          cx="960"
          cy="127"
          r="44"
          fill="none"
          stroke="#ea580c"
          strokeWidth="24"
        />

        {/* 6. Subtitle: Creations & Connections */}
        {showSubtitle && (
          <text
            className="tbm-sub-text"
            x="1012"
            y="226"
            textAnchor="middle"
          >
            Creations &amp; Connections
          </text>
        )}
      </svg>
    </div>
  );
}
