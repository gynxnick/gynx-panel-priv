@extends('layouts.admin')

@section('title')
    Panel Alerts
@endsection

@section('content-header')
    <a href="{{ route('admin.alerts.create') }}" class="btn btn-sm btn-primary pull-right" style="margin-top: 8px;">
        <i class="fa fa-plus"></i>&nbsp;Create Alert
    </a>
    <h1>Panel Alerts<small>Broadcast notices to everyone, or to users on a specific node.</small></h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li class="active">Alerts</li>
    </ol>
@endsection

@section('content')
    <div class="row">
        <div class="col-xs-12">
            <div class="box box-primary">
                <div class="box-header with-border">
                    <h3 class="box-title">Active + scheduled alerts</h3>
                    <div class="box-tools">
                        <a href="{{ route('admin.alerts.create') }}" class="btn btn-sm btn-primary">Create alert</a>
                    </div>
                </div>
                <div class="box-body table-responsive no-padding">
                    <table class="table table-hover">
                        <tr>
                            <th>Severity</th>
                            <th>Title</th>
                            <th>Scope</th>
                            <th>Window</th>
                            <th>Dismissible</th>
                            <th></th>
                            <th></th>
                        </tr>
                        @forelse($alerts as $a)
                            <tr>
                                <td>
                                    @php
                                        $sev = ['info' => 'info', 'warn' => 'warning', 'maint' => 'primary', 'critical' => 'danger'][$a->severity] ?? 'default';
                                    @endphp
                                    <span class="label label-{{ $sev }}">{{ $a->severity }}</span>
                                </td>
                                <td>
                                    <strong>{{ $a->title }}</strong>
                                    @if($a->body)
                                        <br><small class="text-muted">{{ \Illuminate\Support\Str::limit($a->body, 80) }}</small>
                                    @endif
                                </td>
                                <td>
                                    @if($a->scope === 'panel')
                                        <em>entire panel</em>
                                    @else
                                        node <code>#{{ $a->node_id }}</code> {{ $a->node?->name ?? '' }}
                                    @endif
                                </td>
                                <td>
                                    @if($a->starts_at || $a->ends_at)
                                        <small>
                                            {{ $a->starts_at ? $a->starts_at->format('Y-m-d H:i') : 'now' }}
                                            →
                                            {{ $a->ends_at ? $a->ends_at->format('Y-m-d H:i') : 'forever' }}
                                        </small>
                                    @else
                                        <em class="text-muted">always</em>
                                    @endif
                                </td>
                                <td>{!! $a->dismissible ? '<span class="label label-default">yes</span>' : '<span class="label label-warning">no</span>' !!}</td>
                                <td>
                                    <a href="{{ route('admin.alerts.edit', $a) }}" class="btn btn-xs btn-primary">
                                        <i class="fa fa-pencil"></i>
                                    </a>
                                </td>
                                <td>
                                    <form action="{{ route('admin.alerts.destroy', $a) }}" method="POST" style="display:inline"
                                          onsubmit="return confirm('Delete this alert?')">
                                        {{ csrf_field() }}
                                        {{ method_field('DELETE') }}
                                        <button type="submit" class="btn btn-xs btn-danger">
                                            <i class="fa fa-trash-o"></i>
                                        </button>
                                    </form>
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="7" class="text-center text-muted" style="padding: 24px;">
                                    No alerts yet. Create one to broadcast a notice to panel or node users.
                                </td>
                            </tr>
                        @endforelse
                    </table>
                </div>
            </div>
        </div>
    </div>
@endsection
