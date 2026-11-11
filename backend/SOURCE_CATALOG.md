# Collected brand catalog

Source: [omee products on Google Drive](https://drive.google.com/drive/folders/1O1XG44ciJgOtk633b2bgZw2ZuKJy5Cld).
The 18 brand JSON arrays contain 2,832 source cards as of 2026-11-11.
Source cards can include regional listings and different package sizes; they are not automatically merged by manufacturer SKU.

Use the existing backend environment (`DATABASE_URL` and `CLOUDINARY_*`). No new tables or accounts are needed.
Download the brand JSON files into a directory outside the repository. Do not place secrets or downloaded image archives in git.

```sh
cd backend
npm run catalog:import-sources -- --dir=/absolute/path/to/brand-json-files
npm run catalog:import-sources -- --dir=/absolute/path/to/brand-json-files --apply
npm run cloudinary:migrate
npm run cloudinary:migrate -- --apply
```

For an explicitly started, bounded photo batch, use `npm run cloudinary:migrate -- --apply --concurrency=4 --limit=1500`.
The command supports up to six parallel uploads, reports remaining external image sources, and stops scheduling new uploads on authentication or quota errors.
It is not attached to installation, deployment, or startup; run each batch explicitly.

Cotril Italian and English locale URLs with the same full product slug match the same existing card. Other product slugs and package URLs stay separate. A generic Cotril page title is replaced by its published structured product name when available; the original card is retained unchanged in source data.

The first import command executes the complete import in a transaction and rolls it back for validation. The apply command commits it atomically.
Existing products are matched by imported SKU or exact source URL. Their price, stock, name, category, description and publication status stay unchanged. Collected attributes and the full original card are saved in `characteristics.sourceData`.
New cards are unpublished with zero stock. Only explicit UAH prices become shop prices; absent or foreign prices use zero while preserving the original price and currency in source attributes. Review prices and stock before publishing.
Titles longer than the existing 240-character column are shortened only in `name`; the complete title remains in source data.

Image links reuse `cloudinary_imports` receipts before adding new image rows. Repeating the import does not duplicate an existing source or migrated image.
Cloudinary migration uses the existing receipt table, deterministic public IDs and guarded URL replacements. It can resume after interruption. Sources are limited to the exact image hosts observed in the collected catalog.
Failed uploads retain their source URL and are reported by the migration. Use the downloaded photo archives in Drive if a source has become unavailable; do not mark failed sources as migrated.

Validation performed during preparation: the backend test suite passes. Live import and image migration must be verified separately with committed row counts and Cloudinary receipts; code tests alone do not establish that data was transferred.
