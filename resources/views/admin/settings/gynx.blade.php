@extends('layouts.admin')
@include('partials/admin.settings.nav', ['activeTab' => 'gynx'])

@section('title')
    Gynx Settings
@endsection

@section('content-header')
    <h1>Gynx Settings<small>Panel-specific knobs that aren't part of upstream Pterodactyl.</small></h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li><a href="{{ route('admin.settings') }}">Settings</a></li>
        <li class="active">Gynx</li>
    </ol>
@endsection

@section('content')
    @yield('settings::nav')
    <div class="row">
        <div class="col-xs-12">
            <div class="box">
                <div class="box-header with-border">
                    <h3 class="box-title">Slot Manager</h3>
                </div>
                <form action="{{ route('admin.settings.gynx') }}" method="POST">
                    <div class="box-body">
                        <div class="row">
                            <div class="form-group col-md-12">
                                <label class="control-label">Excluded Nests</label>
                                <div>
                                    <select name="excluded_nests[]" class="form-control" multiple size="{{ max(6, min(14, count($nests))) }}">
                                        @foreach ($nests as $nest)
                                            <option
                                                value="{{ $nest->id }}"
                                                @if (in_array((int) $nest->id, $selectedNestIds, true)) selected @endif
                                            >
                                                {{ $nest->name }} (#{{ $nest->id }})@if ($nest->description) — {{ \Illuminate\Support\Str::limit($nest->description, 80) }}@endif
                                            </option>
                                        @endforeach
                                    </select>
                                    <p class="text-muted">
                                        <small>
                                            Servers whose egg lives in a selected nest will see the Slot Manager card
                                            in a locked state with the reason
                                            <em>&ldquo;Slot editing is disabled for this server type.&rdquo;</em>
                                            The gate is enforced server-side, so direct API calls also fail with 403.
                                            Hold <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> to toggle multiple selections.
                                            Save with an empty selection to allow every nest.
                                        </small>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="box-footer">
                        {!! csrf_field() !!}
                        <button type="submit" name="_method" value="PATCH" class="btn btn-sm btn-primary pull-right">Save</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
@endsection
