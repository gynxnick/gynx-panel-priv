@extends('layouts.admin')

@php $editing = $alert !== null; @endphp

@section('title')
    {{ $editing ? 'Edit alert' : 'New alert' }}
@endsection

@section('content-header')
    <h1>{{ $editing ? 'Edit alert #' . $alert->id : 'New alert' }}<small>Shown in the top-strip and bell dropdown to users within scope.</small></h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li><a href="{{ route('admin.alerts.index') }}">Alerts</a></li>
        <li class="active">{{ $editing ? 'Edit' : 'New' }}</li>
    </ol>
@endsection

@section('content')
    <div class="row">
        <div class="col-xs-12">
            <div class="box box-primary">
                <div class="box-body">
                    <form action="{{ $editing ? route('admin.alerts.update', $alert) : route('admin.alerts.store') }}" method="POST">
                        {{ csrf_field() }}
                        @if($editing) {{ method_field('PATCH') }} @endif

                        <div class="row">
                            <div class="col-md-2 form-group">
                                <label>Severity <span class="text-danger">*</span></label>
                                <select name="severity" class="form-control">
                                    @foreach(['info','warn','maint','critical'] as $s)
                                        <option value="{{ $s }}" @if(($alert->severity ?? 'info') === $s) selected @endif>{{ $s }}</option>
                                    @endforeach
                                </select>
                            </div>
                            <div class="col-md-2 form-group">
                                <label>Scope <span class="text-danger">*</span></label>
                                <select name="scope" class="form-control" id="alert-scope">
                                    <option value="panel" @if(($alert->scope ?? 'panel') === 'panel') selected @endif>entire panel</option>
                                    <option value="node"  @if(($alert->scope ?? null) === 'node')  selected @endif>single node</option>
                                </select>
                            </div>
                            <div class="col-md-4 form-group" id="alert-node-group">
                                <label>Node (when scope = node)</label>
                                <select name="node_id" class="form-control">
                                    <option value="">—</option>
                                    @foreach($nodes as $n)
                                        <option value="{{ $n->id }}" @if(($alert->node_id ?? null) === $n->id) selected @endif>{{ $n->name }}</option>
                                    @endforeach
                                </select>
                            </div>
                            <div class="col-md-4 form-group">
                                <label>Dismissible</label>
                                <select name="dismissible" class="form-control">
                                    <option value="1" @if(($alert->dismissible ?? true)) selected @endif>yes</option>
                                    <option value="0" @if(!($alert->dismissible ?? true)) selected @endif>no — sticky</option>
                                </select>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Title <span class="text-danger">*</span></label>
                            <input type="text" name="title" class="form-control" maxlength="200" required
                                   value="{{ $alert->title ?? '' }}"
                                   placeholder="e.g. Maintenance window tonight 22:00 UTC">
                        </div>

                        <div class="form-group">
                            <label>Body</label>
                            <textarea name="body" class="form-control" rows="3" maxlength="2000"
                                      placeholder="Short, user-facing details.">{{ $alert->body ?? '' }}</textarea>
                        </div>

                        <div class="form-group">
                            <label>Learn-more URL (optional)</label>
                            <input type="url" name="link_url" class="form-control" maxlength="2048"
                                   value="{{ $alert->link_url ?? '' }}"
                                   placeholder="https://status.gynx.gg/...">
                        </div>

                        <div class="row">
                            <div class="col-md-6 form-group">
                                <label>Starts at (optional)</label>
                                <input type="datetime-local" name="starts_at" class="form-control"
                                       value="{{ $alert?->starts_at?->format('Y-m-d\TH:i') }}">
                            </div>
                            <div class="col-md-6 form-group">
                                <label>Ends at (optional)</label>
                                <input type="datetime-local" name="ends_at" class="form-control"
                                       value="{{ $alert?->ends_at?->format('Y-m-d\TH:i') }}">
                            </div>
                        </div>

                        <button type="submit" class="btn btn-primary btn-sm">{{ $editing ? 'Save changes' : 'Create alert' }}</button>
                        <a href="{{ route('admin.alerts.index') }}" class="btn btn-default btn-sm">Cancel</a>
                    </form>
                </div>
            </div>
        </div>
    </div>
@endsection

@section('footer-scripts')
    @parent
    <script>
        (function () {
            var scopeSel = document.getElementById('alert-scope');
            var nodeGroup = document.getElementById('alert-node-group');
            function toggle() { nodeGroup.style.opacity = scopeSel.value === 'node' ? '1' : '0.4'; }
            scopeSel.addEventListener('change', toggle);
            toggle();
        })();
    </script>
@endsection
