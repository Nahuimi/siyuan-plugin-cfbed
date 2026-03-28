# SiYuan CloudFlare ImgBed Plugin

[简体中文](./README_zh_CN.md)

This plugin helps manage images in the **current SiYuan document** and upload them to [CloudFlare-ImgBed](https://github.com/MarSeventh/CloudFlare-ImgBed).

## Features

- Support **multiple CloudFlare-ImgBed profiles**
- Support **light / dark / auto** theme switching in the panel
- Scan images from the **current note only**
- Classify images by source:
  - Local
  - External
  - Own image host
- Configure custom domains to identify your **own image host**
- Batch upload filtered images to the active profile
- Optional **auto replace after upload**
- When auto replace is enabled, pasted or dragged local images in the SiYuan editor are also **auto uploaded and replaced**
- Support **custom naming templates** for upload folder and uploaded file name
- Support **channel-specific chunk rules** for Telegram and Discord

## Usage

### Open the panel

After enabling the plugin, open the image manager via:

- the top bar button
- the plugin settings entry

### Configure CloudFlare-ImgBed

Each profile supports:

- name
- host
- token / API key
- auth code
- upload channel
- channel name
- upload folder
- upload name type
- custom file name template
- return format

Advanced upload behavior depends on the selected channel:

- **Telegram**: chunk upload only when the file is larger than `20MB`, default chunk size is `16MB`, server compress is available
- **Discord**: chunk upload only when the file is larger than `10MB`, default chunk size is `8MB`
- **Other channels**: direct upload by default, no client-side chunk upload

### Custom naming templates

`Upload Folder` and `Custom File Name Template` support placeholders.

Supported placeholders:

| Placeholder | Meaning | Example |
| --- | --- | --- |
| `${noteFileName}` | Current note file name without `.md` | `Project Weekly Report` |
| `${noteFolderName}` | Current note folder name | `Projects` |
| `${noteFolderPath}` | Current note folder path | `Notes/Projects` |
| `${noteFilePath}` | Full current note path | `Notes/Projects/Project Weekly Report.md` |
| `${originalAttachmentFileName}` | Original attachment file name without extension | `image` |
| `${originalAttachmentFileExtension}` | Original attachment extension without `.` | `png` |
| `${date}` | Current date, default `YYYYMMDD` | `20260327` |
| `${time}` | Current time, default `HHmmss` | `153045` |
| `${datetime}` | Current date and time, default `YYYYMMDD-HHmmss` | `20260327-153045` |
| `${timestamp}` | Current millisecond timestamp | `1774596645123` |
| `${uuid}` | Random UUID | `550e8400-e29b-41d4-a716-446655440000` |

Formatting options:

- String placeholders support simple formatting such as `${noteFileName:{case:'lower'}}`
- String placeholders also support `${originalAttachmentFileName:{slugify:true}}`
- `${date}`, `${time}`, `${datetime}` support a moment-style format option such as `${date:{momentJsFormat:'YYYY-MM-DD'}}`
- Multiple placeholders can be mixed, for example `${noteFileName}-${datetime}-${originalAttachmentFileName}`

Behavior notes:

- In `custom` mode, the plugin renames the file from the template first, then uploads it using the `origin` naming mode
- A common upload folder template is `${noteFolderName}/${date}`

### Theme switching

The top-right area of the panel includes a theme toggle button.

- **Auto**: follow the system color scheme
- **Light**: use the light palette
- **Dark**: use the dark palette

This setting is persisted locally.

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
- extract image URLs from Markdown and HTML
- classify and display them

Then you can filter, select, upload, and replace links.

### Auto replace

The plugin provides a switch for **auto replacing image links after upload**.

- Off: upload only, do not modify note content
- On: uploaded note images are replaced automatically after success
- On: pasted or dragged local images inserted into the SiYuan editor are also auto uploaded and replaced

## Notes

1. Compatibility with CloudFlare-ImgBed is implemented through configurable request and response behavior
2. Link replacement currently works by replacing strings in the document Markdown source, so test on important notes first
3. Browser-side fetching may fail for remote images protected by anti-leeching, auth, or strict CORS rules
4. The uploader supports normal upload, `/upload` vs `/upload/` fallback on `405`, and channel-specific chunk upload behavior

## Credits

- [CloudFlare-ImgBed](https://github.com/MarSeventh/CloudFlare-ImgBed)
