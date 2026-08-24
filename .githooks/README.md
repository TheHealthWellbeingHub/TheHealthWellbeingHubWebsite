# Git hooks

`pre-commit` refuses commits authored directly on the production branch.

## Why

This repo's **default branch is its production branch**. Vercel builds it with no
preview or PR gate, so a push to it is a live release. Deploying therefore means
standing on that branch, and the next commit lands there unless you move first.

That happened twice on 24 August 2026, and both times it was silent: the deploy
sequence ends with HEAD on production, and `git push origin <working-branch>`
run from there pushes an unchanged ref and prints success. Nothing in the output
reveals that the commit went to the wrong branch. The second occurrence left
unapproved participant-facing email drafts sitting on the production branch.

Memory did not prevent the second one. This does.

## Enabling it

Hooks are not enabled by a clone — git needs to be told where they live:

    git config core.hooksPath .githooks

Claude Code sessions do this automatically via the `SessionStart` hook in
`.claude/settings.json`. Anyone working outside Claude Code runs it once.

To confirm it is active:

    git config core.hooksPath        # -> .githooks

## Deploying

The hook blocks authoring, not releasing. A deliberate deploy says so:

    ALLOW_PROD_COMMIT=1 git merge --no-ff <working-branch>
