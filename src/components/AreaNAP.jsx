import React from "react";
import { BUSINESS, formatBusinessAddress } from "../utils/seoConstants.js";

/**
 * Shared office NAP (Name, Address, Phone) line for area-guide pages.
 * Values come only from seoConstants.js so the entity stays consistent
 * across every city hub and the areas index.
 */
export default function AreaNAP({ className = "" }) {
  return (
    <p className={`text-sm sm:text-base leading-relaxed ${className}`.trim()}>
      <span className="font-semibold">{BUSINESS.name}</span>
      {" · "}
      {formatBusinessAddress()}
      {" · "}
      <a
        href={`tel:${BUSINESS.telephone}`}
        className="font-semibold underline underline-offset-2 hover:opacity-80"
      >
        {BUSINESS.telephone}
      </a>
    </p>
  );
}
