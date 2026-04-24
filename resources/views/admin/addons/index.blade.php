@extends('layouts.admin')

@section('title')
    {{ $title }} — Add-ons
@endsection

@section('content-header')
    <h1>{{ $title }}<small>Every installation across every server.</small></h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li>Add-ons</li>
        <li class="active">{{ $title }}</li>
    </ol>
@endsection

@section('content')
    <div class="row">
        <div class="col-xs-12">
            <ul class="nav nav-tabs" style="margin-bottom: 8px;">
                <li class="{{ $kind === 'plugins' ? 'active' : '' }}"><a href="{{ route('admin.addons.plugins') }}">Plugins</a></li>
                <li class="{{ $kind === 'mods' ? 'active' : '' }}"><a href="{{ route('admin.addons.mods') }}">Mods</a></li>
                <li class="{{ $kind === 'modpacks' ? 'active' : '' }}"><a href="{{ route('admin.addons.modpacks') }}">Modpacks</a></li>
            </ul>

            <div class="box box-primary">
                <div class="box-header with-border">
                    <h3 class="box-title">{{ $title }} log ({{ $items->count() }})</h3>
                </div>
                <div class="box-body table-responsive no-padding">
                    <table class="table table-hover">
                        <tr>
                            <th>Server</th>
                            <th>Source</th>
                            <th>Name</th>
                            <th>Version</th>
                            <th>File</th>
                            <th>Installed by</th>
                            <th>Installed</th>
                            <th></th>
                        </tr>
                        @forelse($items as $i)
                            <tr>
                                <td>
                                    @if($i->server)
                                        <a href="{{ route('admin.servers.view', $i->server) }}">
                                            {{ $i->server->name }}
                                        </a>
                                        <br><small class="text-muted"><code>#{{ $i->server_id }}</code></small>
                                    @else
                                        <em class="text-muted">(deleted server)</em>
                                    @endif
                                </td>
                                <td><span class="label label-default">{{ $i->source }}</span></td>
                                <td>
                                    <strong>{{ $i->name }}</strong>
                                    <br><small class="text-muted"><code>{{ $i->external_id }}</code></small>
                                </td>
                                <td>{{ $i->version ?? '—' }}</td>
                                <td><code style="font-size: 11px;">{{ $i->file_name }}</code></td>
                                <td>
                                    @if($i->installer)
                                        {{ $i->installer->username }}
                                    @else
                                        <em class="text-muted">#{{ $i->installed_by }}</em>
                                    @endif
                                </td>
                                <td><small>@datetimeHuman($i->installed_at)</small></td>
                                <td>
                                    <form action="{{ route($destroyRoute, $i) }}" method="POST" style="display:inline"
                                          onsubmit="return confirm('Remove this record? The jar/archive on disk is NOT automatically deleted from /plugins/ or /mods/ — do that via the File Manager if needed.')">
                                        {{ csrf_field() }}
                                        {{ method_field('DELETE') }}
                                        <button type="submit" class="btn btn-xs btn-danger" title="Remove record">
                                            <i class="fa fa-trash-o"></i>
                                        </button>
                                    </form>
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="8" class="text-center text-muted" style="padding: 24px;">
                                    Nothing installed yet.
                                </td>
                            </tr>
                        @endforelse
                    </table>
                </div>
            </div>
        </div>
    </div>
@endsection
