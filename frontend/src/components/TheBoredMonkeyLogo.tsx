'use client';

import React from 'react';

interface TheBoredMonkeyLogoProps {
  className?: string;
  width?: number | string;
  height?: number | string;
  showSubtitle?: boolean;
}

/**
 * TheBoredMonkey Official Animated Vector Logo
 * Features:
 * - 100% accurate vector letterforms from official master image
 * - Full descending 'y' tail at the end of Monkey (completely intact & natural)
 * - 'Creations & Connections' subtitle mathematically DEAD CENTER under the logo
 * - Smooth 60fps CSS hardware-accelerated animated electrical circuit
 * - Infinite razor-sharp clarity on Retina, 4K, 8K displays
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
        viewBox="0 0 625 120"
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
          <linearGradient id="tbmWireGradV3" x1="205" y1="12" x2="432" y2="12" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>

          <style>{`
            .tbm-wire-guide-v3 {
              stroke: #fed7aa;
              stroke-width: 4px;
              opacity: 0.35;
            }
            .tbm-wire-active-v3 {
              stroke-dasharray: 280;
              stroke-dashoffset: 280;
              animation: tbmWireDrawV3 3.6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
            }
            @keyframes tbmWireDrawV3 {
              0% {
                stroke-dashoffset: 280;
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
                stroke-dashoffset: 280;
                opacity: 0.2;
              }
            }

            .tbm-yellow-ring-v3 {
              transform-origin: 205.5px 57.3px;
              animation: tbmYellowPulseV3 3.6s ease-in-out infinite;
            }
            @keyframes tbmYellowPulseV3 {
              0% {
                filter: drop-shadow(0 0 1px rgba(245, 158, 11, 0.3));
                stroke-width: 11px;
              }
              10% {
                filter: drop-shadow(0 0 5px rgba(245, 158, 11, 0.85));
                stroke-width: 12px;
              }
              28% {
                filter: drop-shadow(0 0 2px rgba(245, 158, 11, 0.4));
                stroke-width: 11px;
              }
              42% {
                filter: drop-shadow(0 0 5px rgba(245, 158, 11, 0.75));
              }
              75% {
                filter: drop-shadow(0 0 2px rgba(245, 158, 11, 0.3));
              }
              100% {
                filter: drop-shadow(0 0 1px rgba(245, 158, 11, 0.3));
              }
            }

            .tbm-orange-ring-v3 {
              transform-origin: 432.2px 56.8px;
              animation: tbmOrangePulseV3 3.6s ease-in-out infinite;
            }
            @keyframes tbmOrangePulseV3 {
              0%, 26% {
                filter: drop-shadow(0 0 1px rgba(234, 88, 12, 0.3));
                stroke-width: 11px;
              }
              38% {
                filter: drop-shadow(0 0 6px rgba(234, 88, 12, 0.9));
                stroke-width: 12px;
              }
              50% {
                filter: drop-shadow(0 0 3px rgba(234, 88, 12, 0.5));
                stroke-width: 11px;
              }
              75% {
                filter: drop-shadow(0 0 2px rgba(234, 88, 12, 0.3));
              }
              100% {
                filter: drop-shadow(0 0 1px rgba(234, 88, 12, 0.3));
              }
            }

            .tbm-sub-text-v3 {
              animation: tbmSubGlowV3 3.6s ease-in-out infinite;
            }
            @keyframes tbmSubGlowV3 {
              0%, 100% { opacity: 0.9; }
              40%, 75% { opacity: 1; }
            }
          `}</style>
        </defs>

        {/* 1. Underlying Conduit / Guide Path */}
        <path
          className="tbm-wire-guide-v3"
          d="M 205.5 37.8 L 205.5 15.5 Q 205.5 12.1 209 12.1 L 428.5 12.1 Q 432.2 12.1 432.2 15.5 L 432.2 37.8"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* 2. Flowing Electric Circuit Wire */}
        <path
          className="tbm-wire-active-v3"
          d="M 205.5 37.8 L 205.5 15.5 Q 205.5 12.1 209 12.1 L 428.5 12.1 Q 432.2 12.1 432.2 15.5 L 432.2 37.8"
          fill="none"
          stroke="url(#tbmWireGradV3)"
          strokeWidth="6.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* 3. Official Master Wordmark Typography (With 100% Intact & Natural 'y') */}
        <path
          d="M 613 41 L 603 42 L 597 62 L 595 64 L 592 59 L 588 45 L 586 41 L 577 41 L 577 43 L 579 46 L 581 54 L 591 77 L 591 80 L 590 83 L 586 87 L 584 88 L 579 87 L 579 89 L 581 94 L 587 95 L 590 94 L 594 90 L 596 87 L 601 74 L 603 66 L 609 53 Z M 549 41 L 544 44 L 539 49 L 536 57 L 536 62 L 537 66 L 541 73 L 543 75 L 548 78 L 551 79 L 562 79 L 566 78 L 571 75 L 566 69 L 560 72 L 554 72 L 551 71 L 546 66 L 547 63 L 576 63 L 576 55 L 575 52 L 571 46 L 567 43 L 563 41 L 559 40 L 553 40 Z M 546 56 L 546 54 L 552 48 L 560 48 L 562 49 L 566 53 L 567 55 L 565 57 Z M 486 42 L 481 40 L 476 40 L 472 41 L 470 43 L 467 42 L 459 41 L 459 78 L 467 78 L 467 52 L 471 48 L 479 48 L 483 52 L 484 54 L 484 78 L 492 78 L 492 50 L 491 47 Z M 278 40 L 271 43 L 266 47 L 266 48 L 264 50 L 262 55 L 262 65 L 263 68 L 265 71 L 270 76 L 273 78 L 276 79 L 288 79 L 295 76 L 296 73 L 291 69 L 286 72 L 279 72 L 275 70 L 272 67 L 271 65 L 273 63 L 302 62 L 302 57 L 300 51 L 298 48 L 294 44 L 285 40 Z M 271 55 L 272 53 L 276 49 L 278 48 L 285 48 L 287 49 L 292 54 L 291 57 Z M 256 42 L 252 40 L 248 40 L 242 44 L 241 41 L 232 42 L 233 78 L 241 78 L 241 55 L 243 51 L 248 48 L 254 52 L 256 50 L 259 45 Z M 109 41 L 104 44 L 100 48 L 98 51 L 96 58 L 96 61 L 97 62 L 97 66 L 101 73 L 103 75 L 108 78 L 111 79 L 122 79 L 126 78 L 131 75 L 126 69 L 120 72 L 114 72 L 111 71 L 106 66 L 107 63 L 136 63 L 136 55 L 134 50 L 127 43 L 123 41 L 119 40 L 113 40 Z M 106 56 L 106 54 L 112 48 L 120 48 L 122 49 L 125 52 L 125 53 L 127 55 L 125 57 Z M 353 27 L 353 78 L 362 78 L 363 45 L 369 54 L 372 61 L 376 68 L 379 70 L 380 67 L 391 50 L 394 44 L 395 78 L 404 78 L 404 27 L 394 27 L 392 29 L 383 44 L 381 49 L 378 51 L 374 46 L 364 27 Z M 144 27 L 144 78 L 170 78 L 173 77 L 179 71 L 181 67 L 181 61 L 180 58 L 178 55 L 175 53 L 174 51 L 176 49 L 178 45 L 178 37 L 177 34 L 171 28 L 168 27 Z M 153 57 L 155 55 L 163 55 L 168 57 L 170 59 L 171 61 L 171 66 L 168 69 L 163 71 L 155 71 L 153 69 Z M 154 34 L 164 34 L 169 39 L 169 44 L 165 48 L 163 49 L 155 49 L 153 47 Z M 11 28 L 12 35 L 26 36 L 26 78 L 36 78 L 37 35 L 50 35 L 50 27 Z M 501 25 L 501 78 L 509 78 L 511 63 L 525 78 L 535 78 L 531 74 L 531 73 L 521 63 L 519 60 L 519 58 L 523 54 L 527 48 L 533 41 L 522 42 L 513 53 L 513 54 L 509 55 L 509 25 Z M 343 25 L 334 25 L 331 41 L 328 40 L 322 40 L 319 41 L 314 44 L 311 47 L 308 52 L 307 55 L 307 64 L 308 68 L 311 73 L 314 76 L 317 78 L 320 79 L 329 79 L 331 78 L 343 77 Z M 323 48 L 330 48 L 332 49 L 334 51 L 334 68 L 331 71 L 328 72 L 325 72 L 320 70 L 318 68 L 316 64 L 315 59 L 316 55 L 317 53 L 321 49 Z M 56 25 L 56 78 L 65 78 L 65 51 L 68 48 L 73 47 L 77 48 L 81 53 L 81 78 L 90 78 L 90 52 L 88 47 L 86 44 L 82 41 L 78 40 L 72 40 L 68 42 L 65 41 L 65 25 Z"
          fill="#0f172a"
          fillRule="evenodd"
        />

        {/* 4. Yellow 'o' Ring (Bored) */}
        <circle
          className="tbm-yellow-ring-v3"
          cx="205.5"
          cy="57.3"
          r="19.5"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="11"
        />

        {/* 5. Orange 'o' Ring (Monkey) */}
        <circle
          className="tbm-orange-ring-v3"
          cx="432.2"
          cy="56.8"
          r="19.5"
          fill="none"
          stroke="#ea580c"
          strokeWidth="11"
        />

        {/* 6. Subtitle: Creations & Connections (MATHEMATICALLY DEAD CENTER) */}
        {showSubtitle && (
          <path
            className="tbm-sub-text-v3"
            d="M 434 95 L 432 96 L 434 107 Z M 478 94 L 477 95 L 475 95 L 474 97 L 474 99 L 476 101 L 481 102 L 481 106 L 479 107 L 474 104 L 474 106 L 476 108 L 481 108 L 483 106 L 482 101 L 480 100 L 478 100 L 477 96 L 483 97 L 482 95 L 480 94 Z M 458 95 L 457 102 L 457 105 L 459 107 L 459 99 L 462 96 L 464 96 L 466 98 L 467 108 L 467 98 L 466 95 L 464 94 L 462 94 Z M 441 96 L 440 98 L 440 104 L 441 106 L 442 107 L 444 108 L 448 108 L 451 105 L 452 102 L 452 100 L 451 97 L 449 95 L 444 95 Z M 444 96 L 447 96 L 450 99 L 450 103 L 447 106 L 444 106 L 442 104 L 441 102 L 441 100 L 442 98 Z M 410 94 L 406 96 L 405 98 L 405 104 L 406 106 L 407 107 L 409 108 L 413 108 L 415 105 L 413 105 L 412 106 L 409 106 L 407 104 L 407 98 L 409 96 L 415 97 L 414 95 L 412 94 Z M 393 94 L 389 96 L 388 98 L 388 104 L 389 106 L 390 107 L 392 108 L 396 108 L 398 107 L 399 104 L 396 106 L 392 106 L 390 104 L 391 101 L 399 101 L 399 97 L 397 95 L 395 94 Z M 390 98 L 392 96 L 395 96 L 396 100 L 392 100 Z M 372 95 L 373 107 L 374 105 L 373 100 L 374 98 L 376 96 L 380 97 L 381 108 L 382 97 L 381 95 L 379 94 L 376 94 L 375 95 Z M 355 95 L 356 107 L 356 100 L 357 98 L 359 96 L 361 96 L 363 98 L 363 107 L 365 107 L 365 97 L 364 95 L 362 95 L 361 94 L 359 94 Z M 342 94 L 340 95 L 338 97 L 337 100 L 337 103 L 338 105 L 341 108 L 345 108 L 347 107 L 349 103 L 349 99 L 348 97 L 346 95 L 344 94 Z M 342 96 L 345 96 L 347 98 L 347 104 L 345 106 L 340 105 L 339 103 L 339 99 Z M 263 94 L 261 95 L 261 101 L 266 102 L 266 106 L 264 107 L 259 104 L 260 107 L 262 108 L 266 108 L 268 106 L 267 101 L 265 100 L 263 100 L 261 98 L 263 96 L 268 97 L 268 95 L 266 95 L 265 94 Z M 243 95 L 244 107 L 244 100 L 245 98 L 247 96 L 249 96 L 251 98 L 251 107 L 253 107 L 253 97 L 252 95 L 250 95 L 249 94 L 247 94 Z M 230 94 L 229 95 L 227 95 L 225 100 L 225 103 L 227 107 L 229 108 L 233 108 L 235 107 L 237 102 L 237 100 L 236 97 L 234 95 L 232 94 Z M 229 96 L 232 96 L 234 97 L 235 104 L 233 106 L 229 106 L 227 104 L 227 98 Z M 192 95 L 191 99 L 193 96 L 198 98 L 196 100 L 192 101 L 190 103 L 189 105 L 190 107 L 192 108 L 197 107 L 201 108 L 200 97 L 199 95 L 197 95 L 196 94 L 194 94 Z M 191 104 L 194 101 L 198 102 L 198 104 L 196 106 Z M 177 94 L 175 95 L 174 96 L 173 98 L 173 104 L 174 106 L 176 108 L 181 108 L 184 104 L 181 106 L 177 106 L 175 104 L 176 101 L 184 101 L 184 98 L 183 96 L 182 95 L 180 94 Z M 175 98 L 177 96 L 180 96 L 181 100 Z M 168 94 L 162 95 L 162 107 L 164 107 L 164 98 L 166 96 L 168 96 Z M 424 90 L 423 93 L 420 95 L 423 98 L 424 108 L 427 107 L 424 105 L 424 97 L 426 96 L 424 93 Z M 327 90 L 330 93 L 332 93 L 331 90 Z M 318 91 L 317 93 L 317 103 L 318 105 L 320 107 L 322 108 L 328 108 L 330 107 L 331 106 L 331 105 L 332 103 L 329 104 L 329 105 L 322 106 L 319 103 L 318 100 L 318 96 L 319 93 L 323 90 Z M 210 90 L 208 90 L 208 93 L 206 96 L 208 97 L 209 108 L 212 106 L 210 105 L 210 97 L 212 95 L 210 94 Z M 151 90 L 154 93 L 156 93 L 155 90 Z M 142 91 L 141 93 L 141 103 L 142 105 L 144 107 L 146 108 L 152 108 L 154 107 L 156 105 L 156 103 L 154 103 L 152 106 L 146 106 L 144 104 L 143 102 L 143 93 L 147 90 Z"
            fill="#c27803"
            fillRule="evenodd"
          />
        )}
      </svg>
    </div>
  );
}
