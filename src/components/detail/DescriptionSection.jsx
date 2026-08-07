import React from "react";

/**
 * Public remarks — typographically polished (serif lead / drop-cap feel).
 */
export default function DescriptionSection({ description }) {
  const text =
    description && String(description).trim()
      ? String(description).trim()
      : null;

  return (
    <section aria-labelledby="detail-description-heading">
      <h2
        id="detail-description-heading"
        className="text-xl sm:text-2xl font-bold text-gray-900 font-serif mb-3"
      >
        About this home
      </h2>
      {text ? (
        <div className="max-w-prose">
          <p className="text-gray-700 leading-[1.75] whitespace-pre-line text-[15px] sm:text-base first-letter:text-4xl first-letter:font-serif first-letter:font-bold first-letter:text-gray-900 first-letter:float-left first-letter:mr-2 first-letter:mt-0.5 first-letter:leading-none">
            {text}
          </p>
        </div>
      ) : (
        <p className="text-gray-500 text-sm">
          Contact us for details about this property —{" "}
          <a href="tel:+19709991407" className="underline text-gray-800 font-medium">
            (970) 999-1407
          </a>
          .
        </p>
      )}
    </section>
  );
}
