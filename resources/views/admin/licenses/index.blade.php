@extends('layouts.admin')

@section('title')
    License Keys
@endsection

@section('content-header')
    <h1>License Keys<small>Internal entitlement keys — gate features, cap usage, audit who's calling.</small></h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li class="active">Licenses</li>
    </ol>
@endsection

@section('content')
    <div class="row">
        <div class="col-xs-12">
            <div class="alert alert-info" style="margin-bottom: 16px;">
                <strong><i class="fa fa-key"></i> How keys work.</strong>
                Each key is a 32-character token in 4 hyphen-separated groups (e.g. <code>xK3p9aQ2-rnTYbHd5-…</code>).
                Generated client-side on submit, never user-chosen. <strong>Limits</strong> is freeform JSON
                (e.g. <code>{"max_servers": 5, "max_users": 20}</code>) — middleware reads whichever fields it
                cares about. <strong>Features</strong> is a comma-separated list of feature flags this key unlocks
                (e.g. <code>addon_installer, subdomain</code>).
            </div>
        </div>
    </div>

    <div class="row">
        <div class="col-xs-12">
            <div class="box box-primary">
                <div class="box-header with-border">
                    <h3 class="box-title">Issue a key</h3>
                </div>
                <div class="box-body">
                    <form action="{{ route('admin.licenses.store') }}" method="POST">
                        {{ csrf_field() }}
                        <div class="row">
                            <div class="col-md-3 form-group">
                                <label>Label (optional)</label>
                                <input type="text" name="label" class="form-control" maxlength="120"
                                       placeholder="e.g. Internal staging">
                            </div>
                            <div class="col-md-3 form-group">
                                <label>Expires at (optional)</label>
                                <input type="datetime-local" name="expires_at" class="form-control">
                                <p class="text-muted small">Leave blank for never-expires.</p>
                            </div>
                            <div class="col-md-3 form-group">
                                <label>Limits (JSON, optional)</label>
                                <input type="text" name="limits" class="form-control"
                                       placeholder='{"max_servers": 5}'>
                            </div>
                            <div class="col-md-3 form-group">
                                <label>Features (comma-separated)</label>
                                <input type="text" name="features" class="form-control"
                                       placeholder="addon_installer, subdomain">
                            </div>
                        </div>
                        <button type="submit" class="btn btn-primary btn-sm">Issue key</button>
                    </form>
                </div>
            </div>
        </div>
    </div>

    <div class="row">
        <div class="col-xs-12">
            <div class="box box-primary">
                <div class="box-header with-border">
                    <h3 class="box-title">Existing keys</h3>
                </div>
                <div class="box-body table-responsive no-padding">
                    <table class="table table-hover">
                        <tr>
                            <th>Key</th>
                            <th>Label</th>
                            <th>Status</th>
                            <th>Expires</th>
                            <th>Uses</th>
                            <th>Last used</th>
                            <th>Limits</th>
                            <th>Features</th>
                            <th></th>
                        </tr>
                        @forelse($keys as $k)
                            <tr>
                                <td>
                                    <code style="font-size: 11px; word-break: break-all;">{{ $k->key }}</code>
                                </td>
                                <td>{{ $k->label ?: '—' }}</td>
                                <td>
                                    @if($k->status === \Pterodactyl\Models\LicenseKey::STATUS_ACTIVE)
                                        <span class="label label-success">active</span>
                                    @elseif($k->status === \Pterodactyl\Models\LicenseKey::STATUS_REVOKED)
                                        <span class="label label-danger">revoked</span>
                                    @else
                                        <span class="label label-warning">expired</span>
                                    @endif
                                </td>
                                <td>
                                    @if($k->expires_at)
                                        <small>{{ $k->expires_at->diffForHumans() }}</small>
                                    @else
                                        <em class="text-muted">never</em>
                                    @endif
                                </td>
                                <td>{{ $k->use_count }}</td>
                                <td>
                                    @if($k->last_used_at)
                                        <small>{{ $k->last_used_at->diffForHumans() }}</small>
                                    @else
                                        <em class="text-muted">—</em>
                                    @endif
                                </td>
                                <td>
                                    @if($k->limits)
                                        <code style="font-size: 11px;">{{ json_encode($k->limits) }}</code>
                                    @else
                                        <em class="text-muted">—</em>
                                    @endif
                                </td>
                                <td>
                                    @if($k->features)
                                        @foreach($k->features as $f)
                                            <span class="label label-default">{{ $f }}</span>
                                        @endforeach
                                    @else
                                        <em class="text-muted">—</em>
                                    @endif
                                </td>
                                <td style="white-space: nowrap;">
                                    @if($k->status === \Pterodactyl\Models\LicenseKey::STATUS_ACTIVE)
                                        <form action="{{ route('admin.licenses.revoke', $k) }}" method="POST" style="display:inline">
                                            {{ csrf_field() }}
                                            <button type="submit" class="btn btn-xs btn-warning" title="Revoke">
                                                <i class="fa fa-ban"></i>
                                            </button>
                                        </form>
                                    @else
                                        <form action="{{ route('admin.licenses.reactivate', $k) }}" method="POST" style="display:inline">
                                            {{ csrf_field() }}
                                            <button type="submit" class="btn btn-xs btn-success" title="Reactivate">
                                                <i class="fa fa-check"></i>
                                            </button>
                                        </form>
                                    @endif
                                    <form action="{{ route('admin.licenses.rotate', $k) }}" method="POST" style="display:inline"
                                          onsubmit="return confirm('Rotate this key? The old string stops working immediately.')">
                                        {{ csrf_field() }}
                                        <button type="submit" class="btn btn-xs btn-default" title="Rotate (issue new string)">
                                            <i class="fa fa-refresh"></i>
                                        </button>
                                    </form>
                                    <form action="{{ route('admin.licenses.destroy', $k) }}" method="POST" style="display:inline"
                                          onsubmit="return confirm('Delete this key permanently? Usage history will be removed too.')">
                                        {{ csrf_field() }}
                                        {{ method_field('DELETE') }}
                                        <button type="submit" class="btn btn-xs btn-danger" title="Delete">
                                            <i class="fa fa-trash-o"></i>
                                        </button>
                                    </form>
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="9" class="text-center text-muted" style="padding: 24px;">
                                    No keys yet. Issue one above.
                                </td>
                            </tr>
                        @endforelse
                    </table>
                </div>
            </div>
        </div>
    </div>
@endsection
