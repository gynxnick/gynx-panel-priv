{{--
    Shared field set for the add / edit partner-modpack forms.
    Expects: $pack (PartnerModpack|null), $sources (string[])
--}}
@php
    $v = fn (string $key, $default = '') => old($key, $pack->{$key} ?? $default);
    $isVisible = $pack ? (bool) $pack->is_visible : true;   // new packs default visible
    $isFeatured = $pack ? (bool) $pack->is_featured : false;
    $bannerUrl = $v('banner_url');
@endphp

@if($bannerUrl)
    <div class="field__preview" style="margin-bottom:14px;">
        <img src="{{ $bannerUrl }}" alt="" style="max-width:100%; max-height:140px; border-radius:12px;">
    </div>
@endif

<div class="field">
    <label class="field__label">Title</label>
    <input type="text" name="title" class="field__input" maxlength="120" required
           placeholder="e.g. Vault Hunters 3" value="{{ $v('title') }}">
</div>

<div class="field">
    <label class="field__label">Description</label>
    <textarea name="summary" class="field__textarea" rows="2" maxlength="500"
              placeholder="One or two lines shown on the card.">{{ $v('summary') }}</textarea>
</div>

<div class="field">
    <label class="field__label">Banner image URL</label>
    <input type="url" name="banner_url" class="field__input" maxlength="2048"
           placeholder="https://cdn.gynx.gg/modpacks/vault-hunters.png" value="{{ $bannerUrl }}">
    <span class="field__hint">Wide banner works best (≈16:9). Leave blank for a gradient placeholder.</span>
</div>

<div class="fields-row">
    <div class="field">
        <label class="field__label">Provider</label>
        <select name="source" class="field__select" required>
            @foreach($sources as $src)
                <option value="{{ $src }}" {{ $v('source') === $src ? 'selected' : '' }}>{{ ucfirst($src) }}</option>
            @endforeach
        </select>
    </div>
    <div class="field">
        <label class="field__label">Project / external ID</label>
        <input type="text" name="external_id" class="field__input" maxlength="191" required
               placeholder="modrinth slug or curseforge project id" value="{{ $v('external_id') }}">
    </div>
</div>

<div class="fields-row">
    <div class="field">
        <label class="field__label">Version ID <small style="opacity:.6">(optional)</small></label>
        <input type="text" name="version_id" class="field__input" maxlength="191"
               placeholder="pin a specific version, or leave blank for latest" value="{{ $v('version_id') }}">
    </div>
    <div class="field">
        <label class="field__label">Game version <small style="opacity:.6">(optional)</small></label>
        <input type="text" name="game_version" class="field__input" maxlength="64"
               placeholder="e.g. 1.20.1" value="{{ $v('game_version') }}">
    </div>
</div>

<div class="fields-row">
    <div class="field">
        <label class="field__label">Accent color <small style="opacity:.6">(optional hex)</small></label>
        <input type="text" name="accent" class="field__input" maxlength="9"
               placeholder="#7C3AED" value="{{ $v('accent') }}">
        <span class="field__hint">Card glow/badge tint. Defaults to brand purple.</span>
    </div>
    <div class="field">
        <label class="field__label">Sort order</label>
        <input type="number" name="sort_order" class="field__input" min="0" max="9999"
               placeholder="0" value="{{ $v('sort_order', 0) }}">
        <span class="field__hint">Lower numbers appear first.</span>
    </div>
</div>

<div class="fields-row">
    <div class="field">
        <label class="field__label" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
            <input type="checkbox" name="is_visible" value="1" {{ $isVisible ? 'checked' : '' }}>
            <span>Visible in installer</span>
        </label>
    </div>
    <div class="field">
        <label class="field__label" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
            <input type="checkbox" name="is_featured" value="1" {{ $isFeatured ? 'checked' : '' }}>
            <span>Featured (highlighted &amp; sorted first)</span>
        </label>
    </div>
</div>
