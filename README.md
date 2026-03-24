# SiYuan CloudFlare ImgBed Plugin

[简体中文](./README_zh_CN.md)

This plugin helps manage images used in the **current document and its child documents** inside SiYuan, and upload them to [CloudFlare-ImgBed](https://github.com/MarSeventh/CloudFlare-ImgBed).

## Features

- Support **multiple CloudFlare-ImgBed profiles**
- Scan images from the **current note and descendant notes**
- Classify images by source:
  - Local
  - External
  - Own image host
- Configure custom domains to identify your **own image host**
- Filter images and batch upload them to the active CloudFlare-ImgBed profile
- Optional **auto replace links after upload** (disabled by default)
- Manual replacement is also supported after upload

## Usage

### Open panel

After enabling the plugin, open the image manager via:

- the top bar button
- plugin settings entry

### Configure CloudFlare-ImgBed

Each profile supports:

- name
- host
- public domain
- token / API key
- auth code
- upload channel
- channel name
- upload folder
- upload name type
- return format
- auto retry
- server compress (Telegram only)
- chunk size (MB)

These fields now follow the CloudFlare-ImgBed / PicGo uploader style you provided, and common options are presented as selects or switches to reduce manual input.

### Own domains

Add one domain per line, for example:

```txt
img.example.com
cdn.example.com
```

Images from these domains, plus profile public domains, will be classified as `own`.

### Scan and upload

Click **Refresh Scan** to:

- locate the current note
- collect child notes in the same subtree
- extract image URLs from Markdown and HTML
- classify and display them

Then you can filter, select, upload, and replace links.

### Auto replace

The plugin provides a switch for **auto replacing image links after upload**.

- Off: upload only, do not modify note content
- On: replace original links automatically after successful upload

## Development

```bash
npm install
npm run build
```

## Notes

1. Compatibility with CloudFlare-ImgBed is implemented through configurable request/response fields
2. Link replacement currently works by replacing strings in exported Markdown content, so test on important notes first
3. Browser-side fetching may fail for remote images protected by anti-leeching, auth, or strict CORS rules
4. The uploader now supports normal upload, `/upload` vs `/upload/` fallback on 405, and chunked upload for large files

## Credits

- [CloudFlare-ImgBed](https://github.com/MarSeventh/CloudFlare-ImgBed)
- Reference uploader: [picgo-plugin-cfbed-uploader](https://github.com/Nahuimi/picgo-plugin-cfbed-uploader)
