# Claude Code Instructions

This is an Obsidian vault. You have full read/write access.

## Search Strategy (CRITICAL)

Obsidian files often have emoji prefixes, special characters, or unexpected names. **Never assume something doesn't exist without searching thoroughly.**

### Before saying "not found":
1. List all markdown files first
2. Search by content, not just filename
3. Try partial/case-insensitive matches

Content search is more reliable than filename search for vaults with creative naming.

## Obsidian Conventions

- **File format**: Markdown (`.md`)
- **Tasks**: `- [ ] Todo` and `- [x] Done`
- **Links**: `[[Note Name]]` wiki-links, `![[embed]]` for embeds
- **Tags**: `#tag` inline or in YAML frontmatter
- **Frontmatter**: YAML between `---` at file start

## Editing Rules

**Preserve existing structure when editing:**
- Keep the same heading levels (`#`, `##`, `###`)
- Match existing formatting patterns
- Don't "improve" or reorganize unless asked
- Respect frontmatter if present

## Archiving Policy (IMPORTANT)

**Always prefer archiving over deleting.** This is a core principle for this vault.

### Archive location
- **Directory**: `Archive/` in vault root
- **Structure**: Use subfolders like `Archive/2024/`, `Archive/projects/`

### When to archive (move to Archive/):
- Completed projects or tasks
- Outdated notes that might have reference value
- Duplicates (keep the better one, archive the other)
- Old daily notes
- Anything user says to "clean up", "remove", or "get rid of"

### When to actually delete:
- **Only** if user explicitly says "delete" (not "remove", "clean up", etc.)
- Completely empty files with no content
- Temporary files user explicitly confirms are trash

### Archive commands:
```bash
mkdir -p Archive
mv "Old Note.md" Archive/
mv "Done Project.md" "Archive/2024/Done Project.md"
```

**When in doubt, archive. Data preservation over deletion.**

## Best Practices

- Search content, not just filenames
- Edit existing files rather than creating new ones
- Ask before bulk operations
- Archive rather than delete
