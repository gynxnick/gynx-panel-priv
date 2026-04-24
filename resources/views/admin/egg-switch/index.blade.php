@extends('layouts.admin')

@section('title')
    Egg Switch Rules
@endsection

@section('content-header')
    <h1>Egg Switch Rules<small>Control which egg transitions customers can perform from the Game page.</small></h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li class="active">Egg Switch</li>
    </ol>
@endsection

@section('content')
    <div class="row">
        <div class="col-xs-12">
            <div class="box box-primary">
                <div class="box-header with-border">
                    <h3 class="box-title">Add a rule</h3>
                </div>
                <div class="box-body">
                    <form action="{{ route('admin.egg-switch.store') }}" method="POST">
                        {{ csrf_field() }}
                        <div class="row">
                            <div class="col-md-4 form-group">
                                <label>Source egg</label>
                                <select name="source_egg_id" class="form-control">
                                    <option value="">(any egg — global rule)</option>
                                    @foreach($eggs as $egg)
                                        <option value="{{ $egg->id }}">{{ $egg->nest?->name ?? '?' }} / {{ $egg->name }}</option>
                                    @endforeach
                                </select>
                                <p class="text-muted small">If set, the rule only applies when the server is currently running this egg.</p>
                            </div>
                            <div class="col-md-4 form-group">
                                <label>Target egg <span class="text-danger">*</span></label>
                                <select name="target_egg_id" class="form-control" required>
                                    <option value="">— choose —</option>
                                    @foreach($eggs as $egg)
                                        <option value="{{ $egg->id }}">{{ $egg->nest?->name ?? '?' }} / {{ $egg->name }}</option>
                                    @endforeach
                                </select>
                                <p class="text-muted small">The egg the server can switch <em>to</em>.</p>
                            </div>
                            <div class="col-md-2 form-group">
                                <label>Cooldown (minutes)</label>
                                <input type="number" name="cooldown_minutes" class="form-control" value="0" min="0" max="10080">
                                <p class="text-muted small">0 = no cooldown.</p>
                            </div>
                            <div class="col-md-2 form-group">
                                <label>Preserves files?</label>
                                <select name="preserves_files" class="form-control">
                                    <option value="0">No — wipes</option>
                                    <option value="1">Yes — keeps</option>
                                </select>
                                <p class="text-muted small">Informational warning shown to users.</p>
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-12 form-group">
                                <label>Warning copy</label>
                                <input type="text" name="warning_copy" class="form-control" maxlength="500"
                                       placeholder="e.g. Switching to Valheim wipes your Minecraft world.">
                                <p class="text-muted small">Optional. Shown in the confirm dialog.</p>
                            </div>
                        </div>
                        <button type="submit" class="btn btn-primary btn-sm">Add rule</button>
                    </form>
                </div>
            </div>
        </div>
    </div>

    <div class="row">
        <div class="col-xs-12">
            <div class="box box-primary">
                <div class="box-header with-border">
                    <h3 class="box-title">Existing rules</h3>
                </div>
                <div class="box-body table-responsive no-padding">
                    <table class="table table-hover">
                        <tr>
                            <th>Source</th>
                            <th>Target</th>
                            <th>Preserves files</th>
                            <th>Cooldown</th>
                            <th>Warning</th>
                            <th>Status</th>
                            <th></th>
                            <th></th>
                        </tr>
                        @forelse($rules as $rule)
                            <tr>
                                <td>
                                    @if($rule->sourceEgg)
                                        <code>#{{ $rule->source_egg_id }}</code> {{ $rule->sourceEgg->name }}
                                    @else
                                        <em class="text-muted">any egg</em>
                                    @endif
                                </td>
                                <td>
                                    <code>#{{ $rule->target_egg_id }}</code> {{ $rule->targetEgg?->name ?? '(deleted)' }}
                                </td>
                                <td>{!! $rule->preserves_files
                                    ? '<span class="label label-success">yes</span>'
                                    : '<span class="label label-warning">no — wipes</span>' !!}</td>
                                <td>
                                    @if($rule->cooldown_minutes > 0)
                                        {{ $rule->cooldown_minutes }}m
                                    @else
                                        <em class="text-muted">none</em>
                                    @endif
                                </td>
                                <td style="max-width: 300px;">
                                    <small>{{ $rule->warning_copy ?: '—' }}</small>
                                </td>
                                <td>{!! $rule->enabled
                                    ? '<span class="label label-success">enabled</span>'
                                    : '<span class="label label-default">disabled</span>' !!}</td>
                                <td>
                                    <form action="{{ route('admin.egg-switch.toggle', $rule) }}" method="POST" style="display:inline">
                                        {{ csrf_field() }}
                                        <button type="submit" class="btn btn-xs btn-default">
                                            {{ $rule->enabled ? 'Disable' : 'Enable' }}
                                        </button>
                                    </form>
                                </td>
                                <td>
                                    <form action="{{ route('admin.egg-switch.destroy', $rule) }}" method="POST" style="display:inline"
                                          onsubmit="return confirm('Delete this rule?')">
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
                                <td colspan="8" class="text-center text-muted" style="padding: 24px;">
                                    No rules yet. Add one above to let customers switch games.
                                </td>
                            </tr>
                        @endforelse
                    </table>
                </div>
            </div>
        </div>
    </div>
@endsection
