# HorseUp deal room

<!-- impeccable:product-schema 1 -->

## Platform

web, including mobile browsers.

## Users

Rob and Judith manage the library and investor access. Invited investors review
documents and discuss questions with the HorseUp team and their own room members.

## Product Purpose

Support HorseUp's pre-seed investor conversations at Slush in November 2026.
One room link provides access to selected published documents and private
room-wide discussions, without exposing other investors' conversations.

## Operating Context

Authors work in Google Drive, then manually export and upload PDFs. The central
library holds published versions. Rooms always show the latest published version;
existing discussions preserve the document version/page they reference.

## Capabilities and Constraints

- One configurable access stage per room; selected documents have minimum stages.
- Multiple invitees, invitations by email, later membership additions/removal.
- NextAuth email-link login, Resend email, no Clerk and no Drive integration.
- Timestamped discussions, stable order, resolve/reopen history, room-scoped mentions.
- Room visits, viewed pages and estimated visible time, available to administrators.
- Dedicated self-hosted entrypoint in horseup/hu-papermark; no enterprise runtime.
- PostgreSQL on the AWS host, private versioned EU S3 storage, Databasus backups.
- Baseline infrastructure budget below USD 50/month; 50 GiB storage planning target.

## Brand Commitments

HorseUp identity; the existing HorseUp monorepo design system is the visual
authority. No new visual identity is being commissioned.

## Evidence on Hand

The product scope comes from the owner's interview. No actual investor documents
have been supplied. Development fixtures must be clearly synthetic and never
presented as company financial information.

## Product Principles

- A single published document library, separate investor conversations.
- Deny access unless current membership, stage and document selection permit it.
- Keep old discussion context while publishing new versions.
- Reuse eligible open-source core code and implement missing room behavior independently.
