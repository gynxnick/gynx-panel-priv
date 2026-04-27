@extends('layouts.gynx-admin')

@section('title', 'Subdomains')
@section('header-title', 'Subdomains')
@section('header-sub', 'Cloudflare-managed parent zones the panel can issue subdomains under.')

@section('content')
    <div class="alert alert--info">
        <strong>How this works.</strong>
        Add the parent domains you've set up in Cloudflare here (e.g. <code>play.gynx.gg</code>).
        Users on the panel can then claim a hostname like <code>myserver.play.gynx.gg</code> from their server's
        Domain tab; the panel creates the matching DNS record(s) under the zone via the Cloudflare API.
        Token must have <code>Zone:DNS:Edit</code> for the chosen zone.
    </div>

    <div class="card">
        <div class="card__header">
            <h3 class="card__title">Add a zone</h3>
        </div>
        <div class="card__body">
            <form action="{{ route('admin.subdomains.store') }}" method="POST">
                {{ csrf_field() }}
                <div class="fields-row">
                    <div class="field">
                        <label class="field__label" for="z-label">Label</label>
                        <input id="z-label" type="text" name="label" class="field__input" maxlength="100"
                               placeholder="Play" required>
                        <span class="field__hint">Human-friendly name shown to users.</span>
                    </div>
                    <div class="field">
                        <label class="field__label" for="z-domain">Domain</label>
                        <input id="z-domain" type="text" name="domain" class="field__input" maxlength="253"
                               placeholder="play.gynx.gg" required>
                        <span class="field__hint">Exact zone hostname configured in Cloudflare.</span>
                    </div>
                    <div class="field">
                        <label class="field__label" for="z-zoneid">Cloudflare zone ID</label>
                        <input id="z-zoneid" type="text" name="provider_zone_id" class="field__input" maxlength="64"
                               placeholder="32-char hex from CF dashboard" required>
                        <span class="field__hint">CF → zone overview → API.</span>
                    </div>
                    <div class="field">
                        <label class="field__label" for="z-token">API token</label>
                        <input id="z-token" type="password" name="provider_token" class="field__input"
                               autocomplete="new-password" maxlength="512"
                               placeholder="scoped: Zone:DNS:Edit" required>
                        <span class="field__hint">Scoped, not Global. Validated on save.</span>
                    </div>
                </div>
                <button type="submit" class="btn btn--primary">Add zone</button>
            </form>
        </div>
    </div>

    <div class="card">
        <div class="card__header">
            <h3 class="card__title">Registered zones</h3>
        </div>
        <div class="card__body" style="padding: 0;">
            <div class="table-wrap" style="border: 0; border-radius: 0;">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Label</th>
                            <th>Domain</th>
                            <th>Provider</th>
                            <th>Active records</th>
                            <th>Status</th>
                            <th class="actions"></th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse($zones as $zone)
                            <tr>
                                <td><strong>{{ $zone->label }}</strong></td>
                                <td><code>{{ $zone->domain }}</code></td>
                                <td><span class="pill pill--info">{{ $zone->provider }}</span></td>
                                <td>{{ $zone->records_count }}</td>
                                <td>
                                    @if($zone->enabled)
                                        <span class="pill pill--success"><span class="pill__dot"></span>enabled</span>
                                    @else
                                        <span class="pill">disabled</span>
                                    @endif
                                </td>
                                <td class="actions">
                                    <div class="btn-row">
                                        <form action="{{ route('admin.subdomains.toggle', $zone) }}" method="POST" style="display:inline">
                                            {{ csrf_field() }}
                                            <button type="submit" class="btn btn--ghost btn--sm">
                                                {{ $zone->enabled ? 'Disable' : 'Enable' }}
                                            </button>
                                        </form>
                                        <form action="{{ route('admin.subdomains.destroy', $zone) }}" method="POST" style="display:inline"
                                              onsubmit="return confirm('Remove this zone? Only allowed when no active records.')">
                                            {{ csrf_field() }}
                                            {{ method_field('DELETE') }}
                                            <button type="submit" class="btn btn--danger btn--sm" {{ $zone->records_count > 0 ? 'disabled' : '' }}>
                                                <i class="fa fa-trash-o"></i>
                                            </button>
                                        </form>
                                    </div>
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="6" class="table-empty">
                                    No zones yet. Add one above to let users claim subdomains.
                                </td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </div>
    </div>
@endsection
