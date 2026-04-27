@extends('layouts.admin')

@section('title')
    License
@endsection

@section('content-header')
    <h1>License<small>This panel's gynx.gg license key.</small></h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li class="active">License</li>
    </ol>
@endsection

@section('content')
    <div class="row">
        <div class="col-xs-12">
            @php
                $statusLabel = match($status['status']) {
                    'valid' => ['cls' => 'success', 'text' => 'Valid'],
                    'invalid' => ['cls' => 'danger', 'text' => 'Invalid'],
                    'unreachable' => ['cls' => 'warning', 'text' => 'Unreachable'],
                    default => ['cls' => 'default', 'text' => 'Unlicensed'],
                };
            @endphp

            @if($status['status'] === 'valid')
                <div class="alert alert-success" style="margin-bottom: 16px;">
                    <strong><i class="fa fa-check-circle"></i> License accepted.</strong>
                    {{ $status['message'] ?: 'OK' }}.
                    @if($status['plan']) Plan: <strong>{{ $status['plan'] }}</strong>. @endif
                    @if($status['max_servers']) Bound {{ $status['bound_count'] }}/{{ $status['max_servers'] }} instances. @endif
                </div>
            @elseif($status['status'] === 'invalid')
                <div class="alert alert-danger" style="margin-bottom: 16px;">
                    <strong><i class="fa fa-times-circle"></i> License rejected.</strong>
                    {{ $status['message'] ?: 'Invalid license.' }}
                </div>
            @elseif($status['status'] === 'unreachable')
                <div class="alert alert-warning" style="margin-bottom: 16px;">
                    <strong><i class="fa fa-exclamation-triangle"></i> Could not reach the license server.</strong>
                    {{ $status['message'] ?: '' }} Last successful check:
                    {{ $status['last_check'] ? \Carbon\Carbon::parse($status['last_check'])->diffForHumans() : 'never' }}.
                </div>
            @else
                <div class="alert alert-info" style="margin-bottom: 16px;">
                    <strong><i class="fa fa-info-circle"></i> No license key set.</strong>
                    Paste your gynx-panel license key below to activate the panel.
                </div>
            @endif
        </div>
    </div>

    <div class="row">
        <div class="col-md-8">
            <div class="box box-primary">
                <div class="box-header with-border">
                    <h3 class="box-title">License key</h3>
                    <div class="box-tools">
                        <span class="label label-{{ $statusLabel['cls'] }}">{{ $statusLabel['text'] }}</span>
                    </div>
                </div>
                <div class="box-body">
                    <form action="{{ route('admin.license.update') }}" method="POST">
                        {{ csrf_field() }}
                        <div class="form-group">
                            <label>Key</label>
                            @if($key)
                                <div style="margin-bottom: 8px; font-family: monospace; word-break: break-all;">
                                    <code>{{ $key }}</code>
                                </div>
                                <input type="text" name="key" class="form-control"
                                       placeholder="Paste a different key to replace…">
                            @else
                                <input type="text" name="key" class="form-control"
                                       placeholder="GYNX-XXXX-XXXX-XXXX-…" required>
                            @endif
                            <p class="text-muted small">
                                Generated on <code>{{ $apiUrl }}</code> at gynx.gg → Admin → Licenses.
                                Pick the <em>gynx panel</em> product when issuing.
                            </p>
                        </div>
                        <button type="submit" class="btn btn-primary btn-sm">
                            {{ $key ? 'Update' : 'Save' }} key
                        </button>
                    </form>

                    @if($key)
                        <hr>
                        <div style="display: flex; gap: 8px;">
                            <form action="{{ route('admin.license.verify') }}" method="POST" style="display:inline">
                                {{ csrf_field() }}
                                <button type="submit" class="btn btn-default btn-sm">
                                    <i class="fa fa-refresh"></i> Re-verify now
                                </button>
                            </form>
                            <form action="{{ route('admin.license.destroy') }}" method="POST" style="display:inline"
                                  onsubmit="return confirm('Clear the license key? Licensed features will lock down on next page load.')">
                                {{ csrf_field() }}
                                {{ method_field('DELETE') }}
                                <button type="submit" class="btn btn-danger btn-sm">
                                    <i class="fa fa-trash-o"></i> Clear key
                                </button>
                            </form>
                        </div>
                    @endif
                </div>
            </div>
        </div>

        <div class="col-md-4">
            <div class="box box-default">
                <div class="box-header with-border">
                    <h3 class="box-title">Details</h3>
                </div>
                <div class="box-body">
                    <dl style="margin: 0;">
                        <dt>Status</dt>
                        <dd><span class="label label-{{ $statusLabel['cls'] }}">{{ $statusLabel['text'] }}</span></dd>

                        <dt style="margin-top: 8px;">Plan</dt>
                        <dd>{{ $status['plan'] ?: '—' }}</dd>

                        <dt style="margin-top: 8px;">Expires</dt>
                        <dd>
                            @if($status['expires_at'])
                                {{ \Carbon\Carbon::parse($status['expires_at'])->diffForHumans() }}
                                <small class="text-muted d-block">{{ \Carbon\Carbon::parse($status['expires_at'])->toDayDateTimeString() }}</small>
                            @else
                                <em class="text-muted">never</em>
                            @endif
                        </dd>

                        <dt style="margin-top: 8px;">Bound instances</dt>
                        <dd>
                            @if($status['max_servers'])
                                {{ $status['bound_count'] }} / {{ $status['max_servers'] }}
                            @else
                                <em class="text-muted">—</em>
                            @endif
                        </dd>

                        <dt style="margin-top: 8px;">Last check</dt>
                        <dd>
                            @if($status['last_check'])
                                {{ \Carbon\Carbon::parse($status['last_check'])->diffForHumans() }}
                            @else
                                <em class="text-muted">never</em>
                            @endif
                        </dd>
                    </dl>
                </div>
            </div>
        </div>
    </div>
@endsection
